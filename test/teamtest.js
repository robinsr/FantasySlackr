var async = require('async'),
	databaseUrl = "fantasyslackr",
	collections = ["teams","playerList","players"],
	db = require("mongojs").connect(databaseUrl, collections),
	objectId = require('mongodb').ObjectID,
	utils = require('util'),
	appErr = require('../util/applicationErrors'),
	parser = require('libxml-to-js'),
	extend = require('extend'),
	Player = require('../objects/player').Player,
	Team = require('../objects/team').Team;

new Team({team_key: "314.l.148766.t.1"},function(args){
	var self = this;
	self.loadRoster(function(){
		async.eachSeries(self.roster,function(p,cb){
			new Player(p,function(){
				this.calcISF(function(){
					console.log(this.name.full + "\n" + utils.inspect(this.isf));
					cb();
				})
			})
		},function(){
			db.players.find({team_key: "314.l.148766.t.1"},{'name.full':1,'isf':1}).sort({'isf.total': -1},function(err,results){
				console.log(results)
			})
		})
	})
})
// 
// new Team({team_key: "314.l.148766.t.1"},function(args){
// 	this.clearRoster(function(args){
// 		console.log('complete')
// 	})
// })


