var redis = require('redis'),
	client = redis.createClient(),
	databaseUrl = "fantasyslackr",
	collections = ["users", "players", "teams", "metadata", "leagues", "activity", "queue"],
	db = require("mongojs").connect(databaseUrl, collections),
	utils = require('util'),
	async = require('async'),
	appErr = require('../util/applicationErrors');

var publishChannel = 'new-yahoo-request';

function Player (obj){
	_id = obj.id;
	this.player_key = obj.player_key;
	this.player_full_name = obj.full;
	this.player_first = obj.first;
	this.player_last = obj.last;
	this.position = obj.position;
	this.selected_position = obj.selected_position;
	this.injury_status = obj.injury_status;
	this.bye_week = obj.bye_week;
	this.undroppable = obj.undroppable;
	this.image_url = obj.image_url;
	this.projected_points = {};
	this.settings = {
		never_drop: false,
		start_if_probable: true,
		start_if_questionable: false
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

Player.prototype.moveToBench = function(replacementPlayerKey){

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

module.exports.Player = Player;