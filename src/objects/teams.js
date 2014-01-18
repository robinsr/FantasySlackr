var databaseUrl = "fantasyslackr",
	collections = ["users", "players", "teams", "metadata", "leagues", "activity", "queue"],
	db = require("mongojs").connect(databaseUrl, collections),
	objectId = require('mongodb').ObjectID,
	utils = require('util'),
	async = require('async'),
	appErr = require('../util/applicationErrors'),
	currentWeek = require('../util/currentWeek').week(),
	Team = require('./team').Team,
	User = require('./user').User,
	jsonxml = require('jsontoxml'),
	extend = require('extend');

var slackrGameKey = "314";

/** 
 * Teams object. 
 */

function Teams(opt,next){
	var self = this;
	if (opt.owner){
		self.owner_plain = opt.owner;
		self.owner = new objectId.createFromHexString(opt.owner.toString().trim());
	}
	next.call(self,arguments);
}


/**
 * Creates a job to get the teams list XML from yahoo
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
Teams.prototype.getLatestXml = function(next) {
	var self = this;
	var requestUrl = 'http://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games/teams';

	new User({_id:self.owner_plain},function(args){
		if (!args.err){
			this.getOauthContext(function(args){
				if (!args.err){
					this.get(requestUrl,function(err,response){
						if (!err){
							self.xml = response;
							self.teamKeys = response.match(/[0-9]{3}\.l\.[0-9]{6}\.t\.[0-9]{1}/g);
							next.call(self,arguments)
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
		} else {
			arguments.err = args.err;
			next.call(self,arguments)
		}
	})
};



module.exports.Teams = Teams;