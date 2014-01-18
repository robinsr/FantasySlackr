// var redis = require('redis'),
// 	client = redis.createClient(),
// 	databaseUrl = "fantasyslackr",
// 	collections = ["teams"],
// 	db = require("mongojs").connect(databaseUrl, collections),
// 	objectId = require('mongodb').ObjectID,
// 	utils = require('util'),
// 	appErr = require('../util/applicationErrors'),
// 	parser = require('libxml-to-js'),
// 	extend = require('extend'),
// 	Oauth = require('./oauth').Oauth,
// 	User = require('./user').User;

// Object.prototype.deepProperty = function(testString,callback) {
// 	var exists = true
// 	try {
//         return eval(testString);
//     }
//     catch (e) {
//         exists = false;
//     } finally {
//     	if (exists) callback.success.call(this,arguments);
//     	else callback.fail.call(this,arguments);
//     }
// };

// function Slackr(next){
// 	next.call(this,arguments);
// }

// Slackr.prototype.getPlayers = function(next) {
// 	var self = this;
// 	var requestUrl = utils.format("http://fantasysports.yahooapis.com/fantasy/v2/league/%s/players", self.league);
// 	self.oauthContext(function(args){
// 		if (!args.err){
// 			this.get(requestUrl,function(err,response){
// 				if (!err){
// 					console.log(response)
// 					parser(response,function(err,newData){
// 						if (!err){
// 							console.log('Success: Fetched new data')
// 							self.retrieved = new Date().getTime();
// 							extend(self,newData.league.players.player);
// 							self.save(function(args){
// 								next.call(self,arguments);
// 							})
// 						} else {
// 							arguments.err = err;
// 							next.call(self,arguments);
// 						}
// 					})
// 				} else {
// 					arguments.err = err;
// 					next.call(self,arguments);
// 				}
// 			})
// 		} else {
// 			arguments.err = args.err;
// 			next.call(self,arguments)
// 		}
// 	})
// }

// module.exports.Slackr = Slackr;