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
	extend = require('extend');


function Team(opt,next){
	var self = this;

	if (opt.team_key){
		self.team_key = opt.team_key;
		self.findByKey(function(args){
			if (args.err) arguments.err = args.err;
			next.call(self,arguments);
		})
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
module.exports.Team = Team;