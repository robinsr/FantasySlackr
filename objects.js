var async = require('async');

function team(obj){
	_id = obj.id
	this.owner = obj.owner;
	this.team_key = obj.team_key;
	this.name = obj.name;
	this.league = obj.team_key.split('.').splice(0,3).join('.');
	this.game = obj.team_key.split('.').splice(0,1).join('');
	this.active = false,
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

team.prototype = {
	addPlayer : function(player){
		this.roster.push(player);
	},
	hasPlayer : function(player,cb){
		async.detect(this.roster,function(item,callback){
			this.roster.forEach(function(rosterMember){
				if (roster.Member.yahoo_player_id == item.yahoo_player_id){
					callback(true)
				} else {
					callback(false)
				}
			});
		},cb(result));
	}
}

module.exports.team = team;

module.exports.player = function(obj){
	_id = obj.id;
	this.player_key = obj.player_key;
	this.player_full_name = obj.full;
	this.player_first = obj.first;
	this.player_last = obj.last;
	this.position = obj.position,
	this.injury_status = obj.injury_status,
	this.bye_week = obj.bye_week,
	undroppable: obj.undroppable,
	this.projected_points = {};
	this.settings = {
		never_drop: false,
		start_if_probable: true,
		start_if_questionable: false
	};
}
