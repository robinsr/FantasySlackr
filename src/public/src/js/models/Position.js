function position(obj){
	var self = this;
	self.position = obj.position;
	self.count = obj.count;
	self.starters = ko.computed(function(){
		var numberOfStarters = ko.utils.arrayFilter(fantasyslackr.viewmodel.selectedPlayers(),function(pos){
			return ((pos.selected_position() == pos.position) && (pos.selected_position() == self.position))
		})
		return numberOfStarters.length
	});
	self.team_key = obj.team_key;
}