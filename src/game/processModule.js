var redis = require('redis'),
	client = redis.createClient(),
	databaseUrl = "fantasyslackr",
	collections = ["users", "players", "teams", "metadata", "leagues", "activity", "queue"],
	db = require("mongojs").connect(databaseUrl, collections),
	utils = require('util'),
	async = require('async'),
	appErr = require('../util/applicationErrors'),
	Player = require('../objects/player');

var publishChannel = 'new-yahoo-request';




/*
 * Determines if any player on a roster has a bye week and creates a job to bench them
 * @param user_object: object
 * @param week: int
 *
 */

function detectByeWeeks(user_object, week, next){
	var self = this;
	self.user_object = user_object;
	db.teams.find({owner: user_object._id},function(err,result){
		if (err) {
			return next(new appErr.database('Error finding user in detectByeWeeks'))
		} else {
			async.eachSeries(result,function(team,cb){
				async.eachSeries(team.roster,function(player,cbi){
					player.owner = user_object;
					player.team_key = team.team_key;

					var playerObj = new Player(player,function(err,playerObj){
						if (playerObj.isBye()) {
						console.log(playerObj.player_full_name+' is on bye!')

						// logic to determine replacement player

						playerObj.moveToBench("replacementPlayerKey",function(err){
							if (err){ console.log(err); }
							cbi(null)
						})
					} else {
						cbi(null)
					}
					});
					
					
					
				},function(err){
					cb(err);
				})
			},function(err){
				next(err)
			})
		}
	})
}


(function(){
	db.users.findOne({email:"email"},function(err,result){
		detectByeWeeks(result,8,function(err){
			if (err){
				console.log(err);
			} else {
				console.log('complete')
			}
			process.exit();
		})
	})
	
})();
