var extend = require('extend'),
	databaseUrl = "fantasyslackr",
	collections = ["leagues"],
	db = require("mongojs").connect(databaseUrl, collections);

function League(opt,next){
	var self = this;
	extend(true,self,opt)
	next.call(self,arguments)
}

League.prototype.save = function(next) {
	var self = this;
	db.leagues.save(self,function(err){
		if (err){
			arguments.err = new appErr.user("Error saving league in database");
			next.call(self,arguments)
		} else {
			next.call(self,arguments)
		}
	})	
};

module.exports.League = League;