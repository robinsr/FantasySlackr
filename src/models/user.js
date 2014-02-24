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

module.exports = function(exporter){
	return exporter.define("User",{
		name: null,
		email: null,
		initial_setup: "incomplete",
		pass: null,
		salt: null,
		leagues: [],
		teams: [],
		players:  [],
		activity: [],
		access_token: null,
		access_token_expires: null,
		access_token_secret: null,
		guid: null,
		session_handle: null,
		session_handle_expired: null,
		current_login: null,
		request_token: null,
		request_verifier: null,
		request_token_secret: null,
		xoauth_request_auth_url: null
	},{
		//classMethods
		findByName: function(name, next){
			db.users.findOne({ name: name },function(err,result){
				if (err || !result) {
					next(err || new Error("Could not find user in database"))
				} else {
					next(result)
				}
			});
		},
		findByRequestToken: function(token, next){
			db.users.findOne({ request_token: token },function(err,result){
				if (err || !result) {
					next(err || new Error("Could not find user in database"))
				} else {
					next(result)
				}
			});
		},
		findById: function(id, next){
			db.users.findOne({ _id: id },function(err,result){
				if (err || !result) {
					next(err || new Error("Could not find user in database"))
				} else {
					next(result)
				}
			});
		}
	},{
		save: function(next){
			db.users.save(this,function(err){
				next(err)
			})
		},
		remove: function(next){
			db.users.remove(this,function(err){
				next(err)
			})
		},
		setup: function(){},
		deactivate: function(){},
		getAccess: function(){},
		refreshToken: function(){},
		getOauthContext: function(){},
		makeSession: function(){},
		destroySession: function(){},
		validateSession: function(){},
		getLatestXml: function(){},
		getAllGameData: function(next){
			var self = this,
			return_object = {},
			parallel = {
				players:function(cb){
					if (!self.players){
						self.getPlayers(function(result){
							utils.isError(result,function(err,result){
								next(err,result)
							})
						})
					} else {
						cb(null, self.players)
					}
				},
				teams:function(cb){
					if (!self.teams){
						self.getTeams(function(result){
							utils.isError(result,function(err,result){
								next(err,result)
							})
						})
					} else {
						cb(null, self.teams)
					}
				},
				leagues: function(cb){
					if (!self.leagues){
						self.getLeagues(function(result){
							utils.isError(result,function(err,result){
								next(err,result)
							})
						})
					} else {
						cb(null, self.leagues)
					}
				},
				activity: function(cb){
					if (!self.activity){
						self.getActivity(function(result){
							utils.isError(result,function(err,result){
								next(err,result)
							})
						})
					} else {
						cb(null, self.activity)
					}
				}
			}
			async.parallel(parallel,function(err,result){
				next(err||result)
			})
		},
		getPlayers: function(){
			var self = this;
			var args = {owner: self._id};
			if (team_key){
				args['team_key'] = team_key;
			}
			console.log(args)
			db.players.find(args,function(err,result){
				if (!err){
					self.players = result;
					next(self.players)
				} else if (err) { 
					next(err)
				}
			})
		},
		getLeagues: function(){
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
							next(err||self.leagues)
						});
					})
				} else {
					next(err)
				}
			})
		},
		getTeams: function(next){
			var self = this;
			db.teams.find({owner:self._id},function(err,result){
				if (err) {
					next(err);
				} else {
					self.teams = result;
					next(self.teams);
				}
			})
		},
		getActivity: function(next){
			var self = this;
			db.activity.find({name:self.name}).sort({date: -1}).limit(5,function(err,result){
				if (err) {
					next(err);
				} else {
					self.activity = result;
					next(self.activity);
				}
			})
		}
	});
}