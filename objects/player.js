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
	jsonxml = require('jsontoxml');

var publishChannel = 'new-yahoo-request';

function Player (obj){
	var self = this;
	
	self.player_key = obj.player_key;
	self.player_full_name = obj.player_full_name;
	self.player_first = obj.player_first;
	self.player_last = obj.player_last;
	self.position = obj.position;
	self.selected_position = obj.selected_position;
	self.injury_status = obj.injury_status;
	self.bye_week = obj.bye_week;
	self.undroppable = obj.undroppable;
	self.image_url = obj.image_url;
	self.owner = obj.owner;
	self.team_key = obj.team_key;

	self._id;
	if (obj.id){
		self._id = obj.id;
	} else {
		self._id = new objectId();
	}

	self.settings = {};
	if (obj.settings) {
		self.settings.never_drop = obj.settings.never_drop;
		self.settings.start_if_probable = obj.settings.start_if_probable;
		self.settings.start_if_questionable = obj.settings.start_if_questionable;
	} else {
		self.settings.never_drop = false;
		self.settings.start_if_probable = true;
		self.settings.start_if_questionable = false;
	};
}

/*
 * Saves the player to the user's record
 *
 */

Player.prototype.save = function(userObject){
	
}

/*
 * Moves the player to bench by creating a job and emitting a "new-yahoo-request" event.
 * @param replacementPlayerKey: string. OPTIONAL. Player can be moved to bench or if a replacementPlayerKey is 
 * supplied then that player will be moved to start in their place.
 *
 */

Player.prototype.moveToBench = function(replacementPlayerKey,next){
	console.log('moving '+this.player_full_name+" to bench")
	var self = this;
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


	var job = new Job.Job({
		type: "Lineup Change",
		action: "bench",
		message: "moving "+self.player_full_name+" to bench",
		priority: "normal",
		player: self,
		url: "http://fantasysports.yahooapis.com/fantasy/v2/team/"+self.team_key+"/roster",
		xml: jsonxml(fantasy_content, {xmlHeader:true})
	}).init(function(err){
		next(err);
	});
	
	
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

module.exports.Player = Player;