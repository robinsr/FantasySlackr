var async = require('async');

function team(id,owner,team_id,team_name){
	_id = id
	this.owner = owner;
	this.team_key = team_id;
	this.team_name = team_name;
	this.league = team_id.split('.').splice(0,3).join('.');
	this.game = team_id.split('.').splice(0,1).join('');
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

module.exports.player = function(id,pid,full,first,last,pos,inj,bye){
	_id = id;
	this.yahoo_player_id = pid;
	this.player_full_name = full;
	this.player_first = first;
	this.player_last = last;
	this.position = pos,
	this.injury_status = inj,
	this.bye_week = bye,
	this.projected_points = {};
	this.settings = {
		never_drop: false,
		start_if_probable: true,
		start_if_questionable: false
	};
}