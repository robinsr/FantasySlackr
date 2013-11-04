var redis = require('redis'),
	client = redis.createClient(),
	databaseUrl = "fantasyslackr",
	collections = ["users", "players", "teams", "metadata", "leagues", "activity", "queue"],
	db = require("mongojs").connect(databaseUrl, collections),
	objectId = require('mongodb').ObjectID,
	utils = require('util'),
	async = require('async'),
	appErr = require('../util/applicationErrors'),
	currentWeek = require('../util/currentWeek').week(),
	Job = require('./job'),
	jsonxml = require('jsontoxml'),
	parser = require('libxml-to-js'),
	extend = require('extend'),
	Oauth = require('./oauth').Oauth,
	Team = require('./team').Team,
	User = require('./user').User;

var publishChannel = 'new-yahoo-request';


/**
 * Player Object
 */
function Player (opt,next){
	var self = this;

	if (opt.team_key && opt.player_key){
		self.team_key = opt.team_key;
		self.player_key = opt.player_key;
		self.findByKeys(function(args){
			if (args.err) arguments.err = args.err;
			next.call(self,arguments);
		})
	}
}

Player.prototype.findByKeys = function(next) {
	var self = this;
	db.players.findOne({player_key: self.player_key, team_key: self.team_key},function(err,result){
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
}

Player.prototype.findById = function(next) {
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
}
/**
 * Retrieves latest XML data for a this player from the player resource
 * Does not get current position (start/bench). Must use roster context for that
 * @param  {Function} next Callback
 */
Player.prototype.getLatestXml = function(next) {
	var self = this
	var requestUrl = utils.format("http://fantasysports.yahooapis.com/fantasy/v2/player/%s/stats", self.player_key);
	new Team({team_key: self.team_key},function(args){
		if (!args.err){
			var team = this;
			new User({_id: team.owner},function(args){
				if (!args.err){
					var user = this;
					new Oauth(user,function(args){
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

/*
 * Saves the player to the user's record
 *
 */
Player.prototype.save = function(next) {
	var self = this;
	db.players.save(self,function(err){
		if (err){
			arguments.err = new appErr.user("Error saving player in database");
			next.call(self,arguments)
		} else {
			next.call(self,arguments)
		}
	})	
};

/*
 * Moves the player to bench by creating a job and emitting a "new-yahoo-request" event.
 * @param replacementPlayerKey: string. OPTIONAL. Player can be moved to bench or if a replacementPlayerKey is 
 * supplied then that player will be moved to start in their place.
 *
 */

Player.prototype.moveToBench = function(replacementPlayerKey,next){
	console.log('moving '+this.player_full_name+" to bench")
	var self = this;

	var requestXML;
	var requestURL = "http://fantasysports.yahooapis.com/fantasy/v2/team/"+self.team_key+"/roster";

	async.series([
		// step 1 formualte the request XML
		function(cb){
			var xmlPlayer = function(pk){
				var player = {};
				if (!pk){
					player.player_key = self.player_key;
					player.position = "BE";
				} else {
					player.player_key = pk;
					player.position = self.position;
				}
				return player;
			}

			var fantasy_content = {};
			fantasy_content.roster = {};
			fantasy_content.roster.coverage_type = "week";
			fantasy_content.roster.week = "13";
			fantasy_content.roster.players = [];
			fantasy_content.roster.players.push(new xmlPlayer());
			fantasy_content.roster.players.push(new xmlPlayer(replacementPlayerKey));

			requestXML = jsonxml(fantasy_content, {xmlHeader:true});
			cb(null)
		},
		// step 2 send the oauth request
		function(cb){
			var oauth = new Oauth(self);
			oauth.put(requestURL,requestXML,function(err,response){
				console.log(err);
				console.log(response);
			})
		},
		// step 3 profit
		function(cb){
			cb(null)
		}
		],function(err){
			if (err){
				// handle err
				next(null)
			} else {
				next(null)
			}
		}
	)	
}

/*
 * Moves a player to start by creating a job and emitting a "new-yahoo-request" event.
 * @param replacementPlayerKey: string. OPTIONAL but probably always necessary. Will move the the replacementPlayerKey
 * player to bench before adding this player to start.
 *
 */

Player.prototype.moveToStart = function(replacementPlayerKey){
	
}

/*
 * Drops the player from the roster and adds a replacement player from the free agent list. Creates two jobs, one
 * for dropping this player and another for adding a the replacement player
 * @param replacementPlayerKey: string. REQUIRED. The player key of the player to be added to roster after drop of
 * this player is complete
 *
 */

Player.prototype.getFreeAgentReplacement = function(replacementPlayerKey){
	
}

/*
 * Creates a waiver claim and submits this player to be dropped depending on the outcome of a waiver claim. 
 * Creates one job and emits "new-yahoo-request"
 * @param replacementPlayerKey: string. REQUIRED. The player key of the player to be claimed and added to 
 * roster after waiver process is complete
 *
 */

Player.prototype.getWaiverReplacement = function(replacementPlayerKey){
	
}

Player.prototype.isBye = function() {
	if (this.bye_week == currentWeek){
		return true
	} else {
		return false
	}
};

// function parseXml(xml,next){
// 	player_key:     xpath.select('player_key/text()',player).toString(),
//     full:           xpath.select('name/full/text()',player).toString(),
//     first:          xpath.select('name/first/text()',player).toString(),
//     last:           xpath.select('name/last/text()',player).toString(),
//     position:       xpath.select('eligible_positions/position/text()',player).toString(),
//     selected_position: xpath.select('selected_position/position/text()',player).toString(),
//     injury_status: 'unknown',
//     bye_week:       xpath.select('bye_weeks/week/text()',player).toString(),
//     undroppable:    xpath.select('is_undroppable/text()',player).toString(),
//     image_url:      xpath.select('image_url/text()',player).toString()
// }

module.exports.Player = Player;