var crypto = require('crypto'),
	slackr_utils =  require('../slackr_utils'),
	appErr = require('../util/applicationErrors'),
	databaseUrl = "fantasyslackr",
	collections = ["users", "players", "teams", "metadata", "leagues", "activity", "queue"],
	db = require("mongojs").connect(databaseUrl, collections),
	objectId = require('mongodb').ObjectID,
	Oauth = require('./oauth').Oauth,
 	utils = require('util'),
 	async = require('async'),
 	extend = require('extend');

var publishChannel = 'new-setup-request';

/*
	User constructor
 */
var User = function(opt,next){
	var self = this;
	self.name = null;
	self.email = null;
	self.initial_setup = 'incomplete';
	self.pass = null;
	self.salt = null;
	self.leagues = [];


		// if a username is supplied, query db
		// if a user is found, extend this with result
	if (opt.uname){
		self.name = opt.uname;
		self.findByName(function(args){
			if (args.err) arguments.err = args.err;
			next.call(self,arguments)
		})

		// if a request token is supplied (by api callback during creation of new user), query db
		// if a user is found, extend this with result
	} else if (opt.request_token){
		self.request_token = opt.request_token;
		self.findByRequestToken(function(args){
			if (args.err) arguments.err = args.err;
			next.call(self,arguments)
		})
	} else if (opt._id){
		self._id = new objectId.createFromHexString(opt._id.toString().trim());
		self.findById(function(args){
			if (args.err) arguments.err = args.err;
			next.call(self,arguments)
		})
	} else {
		next.call(self,arguments)
	}
}

/**
 * Fills out user object fields based on result from db querying for username
 * @param  {Function} next     	Callback
 * @return {[type]}            [description]
 */
User.prototype.findByName = function(next) {
	var self = this;
	db.users.findOne({ name: self.name },function(err,result){
		if (err || !result) {
			arguments.err = new appErr.user("Could not find user in database")
			next.call(self,arguments)
		} else {
			extend(self,result)
			next.call(self,arguments)
		}
	});
};
/**
 * Fills out user object fields based on result from db querying for id
 * @param  {Function} next     	Callback
 * @return {[type]}            [description]
 */
User.prototype.findById = function(next) {
	var self = this;
	db.users.findOne({ _id: self._id },function(err,result){
		if (err || !result) {
			arguments.err = new appErr.user("Could not find user in database")
			next.call(self,arguments)
		} else {
			extend(self,result)
			next.call(self,arguments)
		}
	});
};
/**
 * Fills out user object fields based on result from db querying for request token
 * @param  {Function} next     	Callback
 * @return {[type]}            [description]
 */
User.prototype.findByRequestToken = function(next) {
	var self = this;
	db.users.findOne({ request_token: self.request_token },function(err,result){
		if (err || !result) {
			arguments.err = new appErr.user("Could not find user in database")
			next.call(self,arguments)
		} else {
			extend(self,result)
			next.call(self,arguments)
		}
	});
};

/*
 * Saves the state of the user to mongo
 *
 */
User.prototype.save = function(next) {
	var self = this;
	db.users.save(self,function(err){
		if (err){
			arguments.err = new appErr.user("Error saving user in database");
			next.call(self,arguments)
		} else {
			next.call(self,arguments)
		}
	})	
};


/**
 *  Creates user: 
 *  Checks for taken username,
 *  Hashes and salts password,
 *  Gets oauth tokens,
 *  saves
 */
User.prototype.create = function(opt,next) {
	var self = this;
	db.users.findOne({name:self.name},function(err,result){
		if (err){
			arguments.err = new appErr.user('Error accesing user database');
			next.call(self,arguments);
		} else if (result){
			arguments.err = new appErr.user('User Account Already Exists')
			next.call(self,arguments);
		} else {
			var hash_salt = slackr_utils.requestHashAsync(32);
		    var hashed_pass_and_salt = crypto.createHash('md5').update(opt.upass + hash_salt).digest('hex');

		    self.pass = hashed_pass_and_salt;
		    self.salt = hash_salt;

		    new Oauth(null,function(args){
		    	this.getToken(function(args){
					if (args.err){
						arguments.err = args.err;
						next.call(self,arguments);
					} else {
						extend(self,this.tokenDetails);
						self.save(function(args){
							if (args.err) arguments.err = args.err;
							next.call(self,arguments)
						});
					}
				})
		    })
		}
	});
};
/**
 *  Deactivates user account
 */
User.prototype.deactivate = function(next) {
	// body...
};

/*
 *  ==================                 ==================
 *  ==================      Oauth      ==================
 *  ==================                 ==================
 */ 

/**
 * Exchanges request token for access token
 * @param  {Function} next  Callback
 * @return {[type]}         [description]
 */
User.prototype.getAccess = function(next) {
	var self = this;
	new Oauth(self,function(args){
		this.getAccess(function(args){
			if (args.err){
				arguments.err = args.err;
				next.call(self,arguments);
			} else {
				extend(self,this.tokenDetails);
				self.save(function(args){
					if (args.err) arguments.err = args.err;
					next.call(self,arguments)
				});
			}
		})
    })
};


/**
 * Refreshes users token if necessary
 * @param  {Function} next callback
 */
User.prototype.refreshToken = function(next) {
	var self = this;
	new Oauth(self,function(args){
		this.refresh(function(args){
			if (args.err) {
				arguments.err = args.err;
				next.call(this,arguments)
			} else {
				extend(self,this.tokenDetails);
				self.save(function(args){
					if (args.err) arguments.err = args.err;
					next.call(self,arguments)
				});
			}
		})
	})
};

User.prototype.getOauthContext = function(next) {
	var self = this;
	new Oauth(self,function(args){
		if (!args.err){
			next.call(this,arguments);
		} else {
			arguments.err = args.err;
			next.call(this,arguments);
		}
	})
};

/*
 *  ==================                 ==================
 *  ==================    Sessions     ==================
 *  ==================                 ==================
 */ 

/**
 * Creates a new session id, prolly should replace with expressjs sessions but whatev
 * @param  {Function} next callback
 */
User.prototype.makeSession = function(next) {
	this.currentLogin = slackr_utils.requestHashAsync();
	this.save(function(args){
		if (args.err) arguments.err = args.err;
		arguments.hash = this.currentLogin;
		next.call(this,arguments)
	});
};

/**
 * Removes session id so further requests are invalid
 * @param  {Function} next callback
 */
User.prototype.destroySession = function(next) {
	this.currentLogin = null;
	this.save(function(args){
		if (args.err) arguments.err = args.err;
		next.call(this,arguments)
	});
};

/**
 * Validates a session token
 * @param  {string} session Session string
 * @param  {function} failure Failure Callback
 * @param  {function} success Success Callback
 */
User.prototype.validateSession = function(session,failure,success) {
	if (this.currentLogin && this.currentLogin != session){
		failure.call(this,arguments)
	} else {
		success.call(this,arguments)
	}
};
/*
 *  ==================                 ==================
 *  ==================  Fantasy Things ==================
 *  ==================                 ==================
 */ 

/**
 * After calling create and getAccess, fetches initial XML with user's
 * team listings. If the users teams are already found in the DB, no event
 * is emitted to create them.
 * @param  {Function} next Callback
 * @return {[type]}        [description]
 */
User.prototype.getLatestXml = function(next) {
	var self = this;
	var requestUrl = 'http://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games/teams';

	self.getOauthContext(function(args){
		if (!args.err){
			this.get(requestUrl,function(err,response){
				if (!err){
					console.log(response)
					var keys = response.match(/[0-9]{3}\.l\.[0-9]{6}\.t\.[0-9]{1}/g);
					var newKeys = [];
					async.eachSeries(keys,function(key,cb){
						if (!self.teamKeys || !self.teamKeys.indexOf(key)){
							newKeys.push(key)
						}
						cb()
					},function(){
						if (newKeys.length > 0){
							arguments.keys = newKeys;
							next.call(self,arguments);
						} else {
							next.call(self,arguments);
						}
					})
				} else {
					arguments.err = err;
					next.call(self,arguments)
				}
			})
		} else {
			arguments.err = args.err;
			next.call(self,arguments)
		}
	})
};

User.prototype.stringifyData = function(next) {
	var self = this,
		return_object = {};
	self.getLeagues(function(args){
		if (!args.err){
			self.getPlayers(null,function(args){
				if (!args.err){
					self.getActivity(function(args){
						if (!args.err){
							next(null,{
								players: self.players,
								teams: self.teams,
								leagues: self.leagues,
								activity: self.activity
							})
						} else {
							next(new appErr.game('Error retrieving user data'))
						}
					})
				} else {
					next(new appErr.game('Error retrieving user data'))
				}
			})
		} else {
			next(new appErr.game('Error retrieving user data'))
		}
	})
};

User.prototype.getPlayers = function(team_key,next) {
	var self = this;
	var args = {owner: self._id};
	if (team_key){
		args['team_key'] = team_key;
	}
	console.log(args)
	db.players.find(args,function(err,result){
		if (!err){
			self.players = result;
			next.call(self,arguments);
		} else {
			if (err) arguments.err = err;
			next.call(self,arguments);
		}
	})
};
User.prototype.getLeagues = function(next) {
	var self = this;
	self.getTeams(function(args){
		if (!args.err && this.teams && this.teams.length > 0){
			async.eachSeries(this.teams,function(team,cb){
				db.leagues.findOne({league_key: team.league_key},function(err,result){
					if (err){
						cb("Database error fetching league: "+team.league);
					} else {
						self.leagues.push(result[0]);
						cb(null);
					}
				},function(err){
					if (err) arguments.err = err;
					next.call(self,arguments);
				});
			})
		} else {
			arguments.err = args.err;
			next.call(self,arguments);
		}
	})
};
User.prototype.getTeams = function(next) {
	var self = this;
	db.teams.find({owner:self._id},function(err,result){
        if (err) {
            arguments.err = err;
            next.call(self,arguments);
        } else {
            self.teams = result;
            next.call(self,arguments);
        }
    })
};
User.prototype.getActivity = function(next) {
	var self = this;
	db.activity.find({name:self.name}).sort({date: -1}).limit(5,function(err,result){
        if (err) {
            arguments.err = err;
            next.call(self,arguments);
        } else {
            self.activity = result;
            next.call(self,arguments);
        }
    })
};

module.exports.User = User;

