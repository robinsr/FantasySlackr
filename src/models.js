var async = require('async');

module.exports.team = function (obj){
	_id = obj.id
	this.owner = obj.owner;
	this.team_key = obj.team_key;
	this.name = obj.name;
	this.league = obj.team_key.split('.').splice(0,3).join('.');
	this.game = obj.team_key.split('.').splice(0,1).join('');
	this.active = false;
	this.settings = {
		probable_player: 'start',
		questionable_player: 'start',
		out_player: 'replace_always',
		lack_of_players: 'bye',
		ask_qb: false,
		ask_rb: false,
		ask_wr: false,
		ask_te: false,
		ask_def: false,
		ask_k: false,
		emails: true,
		injury_reports: true
	};
	this.roster = [];
}



module.exports.league = function(obj){
	this._id = obj.id;
	this.league_key = obj.league_key;
	this.name = obj.name;
	this.url = obj.url;
}

module.exports.activity = function(obj){
	this.owner = obj.owner;
	this.name = obj.name;
	this.date = new Date();
	this.type = obj.type;
	this.message = obj.message;
}



/*
 *
 *
 *
 */