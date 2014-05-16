var extend = require('extend'),
	databaseUrl = "fantasyslackr",
	collections = ["leagues"],
	db = require("mongojs").connect(databaseUrl, collections);


module.exports = function(exporter){
	return exporter.define('League',{},{},{
		save = function(next) {
			var self = this;
			db.leagues.save(self,function(err){
				if (err) next(err)
				else next(null)
			});
		}
	});
}
