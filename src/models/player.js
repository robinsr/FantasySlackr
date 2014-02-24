var databaseUrl = "fantasyslackr",
	collections = ["players","teams","leagues"],
	db = require("mongojs").connect(databaseUrl, collections),
	objectId = require('mongodb').ObjectID,
	utils = require('util'),
	async = require('async'),
	appErr = require('../util/applicationErrors'),
	currentWeek = require('../util/currentWeek').week(),
	jsonxml = require('jsontoxml'),
	parser = require('libxml-to-js'),
	extend = require('extend'),
	models = require(__dirname+"/../models");

/**
 * Player Object
 * Get player from database: pass team_key and player_key only will trigger mongo query
 * else if opt.retrieved present (tell-tale sign this player is already in mongo) player will just extend
 */
module.exports = function(exporter){
	return exporter.define('Player',{
		create: function(opt,next){
			return new Player(opt,next)
		}
	})
}
function Player (opt,next){
	var self = this;
		// value to team
	self.vT = {};
	self.settings = {
		never_drop: true,
		start_if_probable: true,
		start_if_questionable: false,
	};

	if (opt.team_key && opt.player_key && !opt.retrieved){
		// assumes current data is not in mongo and will retrieve latest xml
		
		self.team_key = opt.team_key;
		self.player_key = opt.player_key;
		self.findByKeys(function(args){
			if (args.err) arguments.err = args.err;
			next.call(self,arguments);
		})

	} else if (opt.player_key && opt.provisional_team_key){
		// player is not owned by a user (hence no team_key).
		// provisional_player_kay indicates the team context in whcih to 
		// get player data
		
		self.player_key = opt.player_key;
		self.provisional_team_key = opt.provisional_team_key;
		self.getLatestXml(function(argsA){
			self.getOwnership(function(argsB){
				if (argsA.err || argsB.err){
					arguments.err = argsA.err || argsB.err
				}
				next.call(self,arguments);
			})
		})

	} else if (opt.retrieved){
		// assumes latest data current. must call getLatestXml to update

		extend(true,self,opt);
		next.call(self,arguments);
	}
}
Player.prototype =  {
	findByKeys: function(next) {
		var self = this;
		db.players.findOne({player_key: self.player_key, team_key: self.team_key || self.provisional_team_key},function(err,result){
			if (err){
				arguments.err = err;
				next.call(self,arguments)
			} else if (!result) {
				self.getLatestXml(function(args){
					if (args.err) arguments.err = args.err;
					next.call(self,arguments)
				})
			} else {
				extend(self,result)
				next.call(self,arguments);
			}
		})
	},
	findById: function(next) {
		var self = this;
		db.players.findOne({_id: self._id},function(err,result){
			if (err || !result){
				if (err) arguments.err = err;
				next.call(self,arguments)
			} else {
				extend(self,result)
				next.call(self,arguments);
			}
		})
	},
	/**
	 * Retrieves latest XML data for a this player from the player resource
	 * Does not get current position (start/bench). Must use roster context for that
	 * @param  {Function} next Callback
	 */
	getLatestXml: function(next) {
		var self = this;
		var requestUrl = utils.format("http://fantasysports.yahooapis.com/fantasy/v2/player/%s/stats", self.player_key);
		self.oauthContext(function(args){
			if (!args.err){
				this.get(requestUrl,function(err,response){
					if (!err){
						parser(response,function(err,newData){
							if (!err){
								console.log('Success: Fetched new data')
								newData.player.retrieved = new Date().getTime();
								extend(self,newData.player);
								self.save(function(args){
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
	},
	/**
	 * Uses the team context to get the latest lineup position for this player
	 * 
	 * @param  {Function} next Callback
	 */
	getLatestPosition: function(next) {
		var self = this
		var requestUrl = utils.format("http://fantasysports.yahooapis.com/fantasy/v2/team/%s/roster/players", self.team_key);
		self.oauthContext(function(args){
			if (!args.err){
				this.get(requestUrl,function(err,response){
					if (!err){
						parser(response,function(err,newData){
							if (!err){
								console.log('Success: Fetched new data');
								newData.team.roster.players.player.forEach(function(p){
									if (p.player_key == self.player_key){
										self.retrieved = new Date().getTime();
										extend(true,self, p.selected_position)
										self.save(function(args){
											next.call(self,arguments);
										})
									}
								});
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
	},

	getOwnership: function(next) {
		var self = this
		var requestUrl = utils.format("http://fantasysports.yahooapis.com/fantasy/v2/player/%s/percent_owned", self.player_key);
		self.oauthContext(function(args){
			if (!args.err){
				this.get(requestUrl,function(err,response){
					if (!err){
						parser(response,function(err,newData){
							if (!err){
								console.log('Success: Fetched new data');
								console.log(newData)
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
	},

	/**
	 * Creates an oauth context in which to create requests
	 * Oauth requries a user object as a parameter with the user's token details
	 * @param  {Function} next [description]
	 * @return {[type]}        [description]
	 */
	oauthContext: function(next) {
		var self = this;
		new User({_id: this.owner || null},function(args){
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
	},
	/*
	 * Saves the player to the user's record
	 *
	 */
	save: function(next) {
		var self = this;
		db.players.save(self,function(err){
			if (err){
				arguments.err = new appErr.user("Error saving player in database");
				next.call(self,arguments)
			} else {
				next.call(self,arguments)
			}
		})	
	},

	/*
	 * Moves the player to bench by creating a job and emitting a "new-yahoo-request" event.
	 * @param replacementPlayerKey: string. OPTIONAL. Player can be moved to bench or if a replacementPlayerKey is 
	 * supplied then that player will be moved to start in their place.
	 *
	 */

	moveToBench: function(replacementPlayerKey,next){
		console.log('moving '+this.name.full+" to bench")
		var self = this;

		var requestXML;
		var requestURL = "http://fantasysports.yahooapis.com/fantasy/v2/team/"+self.team_key+"/roster";

		async.series([
			// step 0 check if player is already benched
			function(cb){
				self.getLatestPosition(function(args){
					if (args.err){
						cb(args.err);
					} else if (self.selected_position.position == self.eligible_positions.position) {
						cb("Cannot move player on bench to bench");
					} else {
						cb(null)
					}
				})
			},
			// step 1 formualte the request XML
			function(cb){
				var xmlObj = {
					fantasy_content: {
						roster: {
							coverage_type: "week",
							week: "13",
							players: {
								player: [
									{
										player_key: self.player_key,
										position: "BN"
									}
								]
							}
						}
					}
				}
				if (replacementPlayerKey) xml.fantasy_content.roster.players.player.push({player_key:replacementPlayerKey,position:self.eligible_positions.position})
				requestXML = jsonxml(xmlObj, {xmlHeader:true});
				cb(null)
			},
			//step 2 send the oauth request
			function(cb){
				self.oauthContext(function(args){;
					this.put(requestURL,requestXML,function(err,response){
						console.log(err);
						console.log(response);
						cb(null)
					})
				});
			},
			//step 3 profit
			function(cb){
				cb(null)
			}
			],function(err){
				if (err){
					arguments.err = err
					next.call(self,arguments)
				} else {
					next.call(self,arguments)
				}
			}
		)	
	},

	/*
	 * Moves a player to start by creating a job and emitting a "new-yahoo-request" event.
	 * @param replacementPlayerKey: string. OPTIONAL but probably always necessary. Will move the the replacementPlayerKey
	 * player to bench before adding this player to start.
	 *
	 */

	moveToStart: function(replacementPlayerKey){
		
	},

	checkoutTeam: function(benchOnly,next) {
		var self = this;

			// QUERY
		var args = {
				// player is not this player
			'name.full': {$ne: self.name.full},
				// player is on this team
			'team_key' :self.team_key, 
				// player is the same position
			'eligible_positions.position': self.eligible_positions.position, 
				// player does not have a status O, IR, 
			'status': { $ne: [ 'O', 'IR' ] }
		}
		if (benchOnly){
			args['selected_position.position'] = 'BN'
		}
		db.players.find(args,function(err,result){
			if (!err && result){
				next(null,result)
			} else {
				next(err);
			}
		})
	},


	calcValueToTeam: function(next) {
		var self = this;
		var rank = new Ranking(self,function(args){
			this.valueToTeam(function(args){
				self.vT = this;
				next.call(self,arguments)
			})
		})
	},

	/*
	 * Drops the player from the roster and adds a replacement player from the free agent list. Creates two jobs, one
	 * for dropping this player and another for adding a the replacement player
	 * @param replacementPlayerKey: string. REQUIRED. The player key of the player to be added to roster after drop of
	 * this player is complete
	 *
	 */

	getFreeAgentReplacement: function(replacementPlayerKey){
		
	},

	/*
	 * Creates a waiver claim and submits this player to be dropped depending on the outcome of a waiver claim. 
	 * Creates one job and emits "new-yahoo-request"
	 * @param replacementPlayerKey: string. REQUIRED. The player key of the player to be claimed and added to 
	 * roster after waiver process is complete
	 *
	 */

	getWaiverReplacement: function(replacementPlayerKey){
		
	},

	isBye: function() {
		if (this.bye_week == currentWeek){
			return true
		} else {
			return false
		}
	}
}