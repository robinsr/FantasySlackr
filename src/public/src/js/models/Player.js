function Player(obj){
	var self = this;
	_id = obj.id;
	self.team_key = obj.team_key;
	self.team_name = obj.team_name;
	self.player_key = obj.player_key;
	self.player_full_name = obj.name.full;
	self.player_first = obj.name.first;
	self.player_last = obj.name.last;
	self.position = obj.eligible_positions.position;
	self.selected_position = ko.observable(obj.selected_position.position)
	self.selected_position.subscribe(function(val){
		utils.issue("PUT", "method/lineup", {
			player_key: self.player_key,
			team_key: self.team_key,
			move_to: val
		},function(err,stat,text){
			console.log(err,stat,text)
		});
		console.log('player '+self.player_full_name+" was moved to "+val)
	})
	self.injury_status = obj.status ? obj.status : "A";
	self.bye_week = obj.bye_weeks.week;
	self.undroppable = obj.undroppable;
	self.image_url = obj.image_url;
	self.projected_points = {};
	self.settings = {
		never_drop: ko.observable(obj.settings.never_drop),
		start_if_probable: ko.observable(obj.settings.start_if_probable),
		start_if_questionable: ko.observable(obj.settings.start_if_questionable)
	};
}
