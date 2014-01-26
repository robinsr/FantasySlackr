var async = require('async'),
	databaseUrl = "fantasyslackr",
	collections = ["teams","playerList","players"],
	db = require("mongojs").connect(databaseUrl, collections),
	objectId = require('mongodb').ObjectID,
	utils = require('util'),
	appErr = require('../util/applicationErrors'),
	parser = require('libxml-to-js'),
	extend = require('extend'),
	Player = require('./player').Player,
	User = require('./user').User,
	League = require('./league').League;


/**
 * Team constructor
 * @param {object}   opt  opt.team_key
 * @param {Function} next [description]
 */
function Team(opt,next){
	var self = this;
	self.settings = {
		probable_player: 'start',
		questionable_player: 'bench',
		out_player: 'replace',
		lack_of_players: 'replace_injured',
		ask_qb: false,
		ask_rb: false,
		ask_wr: false,
		ask_te: false,
		ask_def: false,
		ask_k: false,
		emails: true,
		injury_reports: true
	};

	if (opt.team_key && opt.owner){
		self.team_key = opt.team_key;
		self.owner = new objectId.createFromHexString(opt.owner.toString().trim());
		self.getLatestXml(function(args){
			if (!args.err){
				next.call(self,arguments);
			} else {
				arguments.err = args.err;
				next.call(self,arguments);
			}
		})
	} else if (opt.team_key){
		self.team_key = opt.team_key;
		self.findByKey(function(args){
			if (args.err) arguments.err = args.err;
			next.call(self,arguments);
		})
	} else {
		next.call(self,arguments)
	}
}

Team.prototype.findByKey = function(next) {
	var self = this;
	db.teams.findOne({team_key: self.team_key},function(err,result){
		if (err){
			arguments.err = err;
			next.call(self,arguments)
		} else if (!result) {
			next.call(self,arguments)
		} else {
			extend(self,result)
			next.call(self,arguments);
		}
	})
}

Team.prototype.save = function(next) {
	var self = this;
	db.teams.save(self,function(err){
		if (err){
			arguments.err = new appErr.user("Error saving team in database");
			next.call(self,arguments)
		} else {
			next.call(self,arguments)
		}
	})	
};

Team.prototype.oauthContext = function(next) {
	var self = this;
	new User({_id: this.owner},function(args){
		if (!args.err){
			this.getOauthContext(function(args){
				if (!args.err){
					next.call(this,arguments);
				} else {
					arguments.err = args.err;
					next.call(self,arguments)
				}
			})
		} else {
			arguments.err = args.err;
			next.call(self,arguments)
		}
	})
};


/**
 * Gets player lists from yahoo for the purposes of finding replacements
 * @param  {[type]}   opt  (details here http://developer.yahoo.com/fantasysports/guide/players-collection.html)
 * sort: NAME (last, first) OR (overall rank) AR (actual rank) PTS (fantasy points)
 * stat: A (all available players) FA (free agents only) W (waivers only) T (all taken players) K (keepers only)
 * position: QB, RB, WR, etc
 * @param  {Function} next Callbac;
 * @return {[type]}        err, array of players
 */
Team.prototype.getPlayersFromYahoo = function(opt,next) {
	var self = this;
	var playerArray = [];
	var requestUrl = utils.format("http://fantasysports.yahooapis.com/fantasy/v2/league/%s/players", self.league_key);

	if (opt.position){
		requestUrl += utils.format(";position=%s", opt.position)
	}
	if (opt.sort) {
		requestUrl += utils.format(";sort=%s", opt.sort)
	}
	if (opt.stat) {
		requestUrl += utils.format(";status=%s", opt.stat)
	}

	self.oauthContext(function(args){
		if (!args.err){
			this.get(requestUrl,function(err,response){
				if (!err){
					parser(response,function(err,newData){
						if (!err){
							console.log('Success: Fetched new data')
							if (newData.league.players.player || newData.league.players.player.length > 0){
								async.each(newData.league.players.player, function(p,cb){
									p.team_key = self.team_key;
									p.retrieved = new Date().getTime();
									playerArray.push(new Player(p,function(args){
										cb(null)
									}))
								},function(err){
									next(null, playerArray)
								})
							} else {
								next(null, playerArray)
							}
						} else {
							next(err);
						}
					})
				} else {
					next(err);
				}
			})
		} else {
			next(args.err);
		}
	})
}

Team.prototype.getLatestXml = function(next) {
	var self = this;
	var requestUrl = utils.format("http://fantasysports.yahooapis.com/fantasy/v2/team/%s/roster/players", self.team_key);
	self.oauthContext(function(args){
		if (!args.err){
			this.get(requestUrl,function(err,response){
				if (!err){
					parser(response,function(err,newData){
						if (!err){
							console.log('Success: Fetched new data');
							extend(self,newData.team);
							self.league_key = self.team_key.match(/[0-9]{3}\.l\.[0-9]{6}/)[0];
							async.parallel([
								function(cb){
									self.getLeague(function(args){
										if (!args.err){
											cb(null);
										} else {
											cb(args.err);
										}
									})
								},
								function(cb){
									self.extractRoster(function(args){
										if (!args.err){
											cb(null);
										} else {
											cb(args.err);
										}
									})
								}],function(err){
									if (err) arguments.err = err;
									next.call(self,arguments);
								})
						} else {
							arguments.err = err;
							next.call(self,arguments);
						}
					})
				} else {
					arguments.err = err;
					next.call(self,arguments);
				}
			})
		} else {
			arguments.err = args.err;
			next.call(self,arguments)
		}
	})
}

Team.prototype.getLeague = function(next) {
	var self = this;
	var requestUrl = utils.format("http://fantasysports.yahooapis.com/fantasy/v2/league/%s/settings", self.league_key);

	self.oauthContext(function(args){
		if (!args.err){
			this.get(requestUrl,function(err,response){
				if (!err) {
					parser(response,function(err,leagueData){
						if (!err){
							new League(leagueData.league, function(args){
								console.log(this)
								this.save(function(args){
									next.call(self,arguments)
								});
							})
						} else {
							arguments.err = err;
							next.call(self,arguments);
						}
					})
				} else {
					arguments.err = err;
					next.call(self,arguments);
				}
			})
		} else {
			arguments.err = args.err;
			next.call(self,arguments)
		}
	})
};

Team.prototype.extractRoster = function(next) {
	var self = this;
	self.deepProperty("this.roster.players.player",{
		fail: function(args){
			arguments.err = new appErr.game("This team has no roster")
			next.call(self,arguments)
		},
		success: function(args){
			async.eachSeries(self.roster.players.player, function(p,cb){
				p.owner = self.owner;
				p.team_key = self.team_key;
				p.retrieved = new Date().getTime();
				new Player(p,function(args){
					this.save(function(args){
						if (args.err) cb(args.err)
						else cb(null);
					});
				});
			},function(err){
				delete self.roster;
				self.save(function(args){
					if (args.err) arguments.err = args.err;
					next.call(self,arguments);
				})
			})
		}
	})
};

Team.prototype.loadRoster = function(next) {
	var self = this;
	db.players.find({team_key:self.team_key},function(err,result){
		self.roster = result;
		next.call(self,arguments);
	})
};

Object.prototype.deepProperty = function(testString,callback) {
  var exists = true
  	try {
        eval(testString);
    } catch (e) {
        exists = false;
    } finally {
		if (exists) callback.success.call(this,arguments);
		else callback.fail.call(this,arguments);
    }
};

module.exports.Team = Team;