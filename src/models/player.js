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
	models = require(__dirname+"/../models"),
	templates = require(__dirname+"/../xml/templates");

/**
 * Player Object
 * Get player from database: pass team_key and player_key only will trigger mongo query
 * else if opt.retrieved present (tell-tale sign this player is already in mongo) player will just extend
 */
module.exports = function(exporter){
	return exporter.define('Player',{
		name: {
			first: null,
			last: null,
			full: null
		},
		settings = {
			never_drop: true,
			start_if_probable: true,
			start_if_questionable: false,
		},
		team_key: null,
		player_key: null,
		bye_week: null
	},{
		findByPlayerAndTeamKey: function(player_key,team_key,next){
			db.players.findOne({player_key: self.player_key, team_key: self.team_key || self.provisional_team_key},function(err,result){
				if (err) next(err);
				else next(null,result);
			});
		},
		findById: function(){
			db.players.findOne({ _id: id },function (err,result){
				if (err) next(err);
				else next(null,result);
			});
		}
	},{
		/*
		 * Saves the player to the user's record
		 *
		 */
		save: function(next) {
			db.players.save(this,function(err){
				next(err);
			});
		},
		/**
		 * Creates an oauth context in which to create requests
		 * Oauth requries a user object as a parameter with the user's token details
		 * @param  {Function} next [description]
		 * @return {[type]}        [description]
		 */
		oauthContext: function(next) {
			async.waterfall([
				function(cb){
					models.User.findById(this.owner,function(err,result){
						cb(err,result)
					});
				},
				function(cb,user){
					var u = models.User.load(user);
					u.getOauthContext(err,oauth){
						next(err,oauth)
					}
				}
			],function(err,result){
				next(err,result)
			});
		},
		get: function(url,next){
			var self = this;
			function getOauthContext(cb){
				self.oauthContext(function(err,oauth){
					cb(err,oauth)
				});
			}
			function getData(oauth,cb){
				oauth.get(requestUrl,function(err,response){
					cb(err,response)
				});
			}
			function parseData(data,cb){
				parser(response,function(err,jsObject){
					cb(err,jsObject)
				});
			}
			async.waterfall([getOauthContext,getData,parseData],function(err,result){
				next(err,result);
			});
		},
		put: function(url,data,next){
			var self = this;
			function getOauthContext(cb){
				self.oauthContext(function(err,oauth){
					cb(err,oauth)
				});
			}
			function putData(oauth,cb){
				oauth.put(requestUrl,data,function(err,response){
					cb(err,response)
				});
			}
			async.waterfall([getOauthContext,putData],function(err,result){
				next(err,result);
			});
		},
		/**
		 * Retrieves latest XML data for a this player from the player resource
		 * Does not get current position (start/bench). Must use roster context for that
		 * @param  {Function} next Callback
		 */
		getLatestXml: function(next) {
			var self = this;
			var requestUrl = utils.format("fantasy/v2/player/%s/stats", self.player_key);
			self.get(requestUrl,function(err,newData){
				if (!err){
					console.log('Success: Fetched new data')
					newData.player.retrieved = new Date().getTime();
					extend(self,newData.player);
					self.save(function(err){
						next(err);
					});
				} else {
					next(err);
				}
			});
		},
		/**
		 * Uses the team context to get the latest lineup position for this player
		 * 
		 * @param  {Function} next Callback
		 */
		getLatestPosition: function(next) {
			var self = this
			var requestUrl = utils.format("fantasy/v2/team/%s/roster/players", self.team_key);
			self.get(requestUrl,function(err,newData){
				if (!err){
					console.log('Success: Fetched new data');
					newData.team.roster.players.player.forEach(function(p){
						if (p.player_key == self.player_key){
							self.retrieved = new Date().getTime();
							extend(true, self, p.selected_position)
							self.save(function(err){
								next(err)
							});
						}
					});
				} else {
					next(err)
				}
			});
		},
		getOwnership: function(next) {
			var self = this
			var requestUrl = utils.format("fantasy/v2/player/%s/percent_owned", self.player_key);
			self.get(requestUrl,function(err,response){
				if (!err){
					parser(response,function(err,newData){
						if (!err){
							console.log('Success: Fetched new data');
							console.log(newData)
						} else {
							next(null)
						}
					})
				} else {
					next(err);
				}
			});
		},
		isBye: function() {
			if (this.bye_week == currentWeek){
				return true
			} else {
				return false
			}
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
		/*
		 * Moves a player to start 
		 *
		 */
		moveToStart: function(next){
			self._movePlayer(self.position, function(err){
				next(err);
			});
		},
		/*
		 * Moves the player to bench
		 *
		 */
		moveToBench: function(next){
			self._movePlayer("BN", function(err){
				next(err);
			});
		},
		/*
			Generic move player function
		 */
		_movePlayer: function(desired_position, next){
			log.info("Moving %s to %s", this.name.full, position);
			var self = this;
			var requestURL = "fantasy/v2/team/"+self.team_key+"/roster";

			async.waterfall([
				function(cb){
					self.getLatestPosition(function(err){
						next(err)
					})
				},
				function(cb){
					if (self.selected_position.position == desired_position) {
						cb(new Error("Cannot move player on bench to bench"));
					} else {
						cb(null)
					}
				}
				function(cb){
					cb(null,templates.movePlayer.render({
						week: "13", // how to get week?
						player_key: self.player_key,
						position: desired_position
					}))
				},
				function(cb,requestXML){
					self.put(requestURL,requestXML,function(err,response){
						log.error(err);
						log.debug(response);
						cb(null)
					});
				}
			],function(err){
				next(err)
			});	
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
		}
	})
}