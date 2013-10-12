var redis = require('redis'),
	client = redis.createClient(),
	databaseUrl = "fantasyslackr",
	collections = ["users", "players", "teams", "metadata", "leagues", "activity"],
	db = require("mongojs").connect(databaseUrl, collections),
	utils = require('util');

var publishChannel = 'new-yahoo-request';

(function(){
	var count = 0;
	setInterval(function(){
		if (count < 3){
			var args = {
				message: Math.random(),
				status: 'requested'
			}
			db.activity.insert(args,function(err, result){
				if (err){
					console.log('db error - processModule')
				} else {
					//console.log('insert success '+result[0]._id)
					client.publish(publishChannel, 'new request generated');
				}
			})
			count++;
		}
	},400)
})();