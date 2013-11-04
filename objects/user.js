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
 	extend = require('extend'),
 	Teams = require('./teams').Teams,
 	dbMod = require('../util/dbModule');


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
			arguments.err = new appErr.user("Error creating user in database");
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

User.prototype.validateSession = function(session,failure,success) {
	if (!this.currentLogin || this.currentLogin != session){
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
 * After calling create and getAccess, setup creates a job that
 * calls the game methods that create the league and team db entries
 * @param  {Function} next Callback
 * @return {[type]}        [description]
 */
User.prototype.setup = function(next) {
	var teamsSetup = new Teams(function(err,teamsSetup){
		teamsSetup.addOwner(self, function(err,teamsSetup){
			teamsSetup.get();
		})
	})
};

User.prototype.stringifyData = function(next) {
	var self = this,
		return_object = {};
	async.series([
    function(callback){
        dbMod.getUsersTeams(self._id,function(err,teams){
            if (err) {
                callback('error');
            } else {
                return_object.teams = [];
                return_object.leagues = [];
                async.each(teams,function(a,b){
                    dbMod.getTeam(a.team_key,function(err,team){
                        if (err){
                            b("error")
                        } else {
                            delete team.owner;
                            console.log(utils.inspect(team));
                            dbMod.getLeague(team.league,function(err,league){
                                if (err){
                                    b("error")
                                } else {
                                    console.log(league);
                                    team.league = league;
                                    return_object.teams.push(team);
                                    b(null);
                                }
                            })
                        }
                    })
                },function(err){callback(err)})
            }
        })
    },
    function(callback){
        dbMod.getActivity(self.name,function(err,feed){
            if (err) {
                callback('error')
            } else {
                return_object.activity = [];
                async.each(feed,function(a,b){
                    dbMod.getActivityItem(a._id,function(err,item){
                        if (err){
                            b("error")
                        } else {
                            return_object.activity.push(item)
                            b(null)
                        }
                    })
                },function(err){callback(err)})
            }
        })
    }
    ],
    function(err,result){
        if (err){
            next('error');
        } else {
            next(null,return_object);
        } 
    })
};

module.exports.User = User;

