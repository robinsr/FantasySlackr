var User = require('../objects/user').User;
var Team = require('../objects/team').Team;
var Player = require('../objects/player').Player;
var async = require('async');

// new User({uname: "name"},function(args){
// 	this.getActivity(function(args){
// 		console.log(this.activity)
// 		process.exit();
// 	})
// })
// new User({uname: "name"},function(args){
// 	this.getTeams(function(args){
// 		console.log(this.teams)
// 		process.exit();
// 	})
// })
// new User({uname: "name"},function(args){
// 	this.getLeagues(function(args){
// 		if (args.err) console.log(args.err)
// 		console.log(this.leagues)
// 		process.exit();
// 	})
// })
new User({uname: "name"},function(args){
	var self = this
	// this.getPlayers(function(args){
	// 	if (args.err) console.log(args.err)
	// 	console.log(this.players)
	// 	console.log(this.players.length)
	// 	process.exit();
	// })
	// this.getPlayers(function(){
	// 	async.eachSeries(this.players, function(player,cb){
	// 		if (player.status){
	// 			console.log(player.name.full +" is currently "+player.status)
	// 			new Team({team_key: player.team_key, player: player.player_key},function(){
	// 				this.getPlayersFromYahoo({
	// 					position: player.eligible_positions.position,
	// 					sort: "OR",
	// 					stat: "A"
	// 				},function(err,pa){
	// 					if (err) console.log('poopdick!')
	// 					async.filter(pa.slice(0,2),function(replacement,truth){
	// 						if (!replacement.status && replacement.eligible_positions.position == player.eligible_positions.position){
	// 							console.log("we can replace him with "+replacement.name.full);
	// 							console.log(replacement)
	// 							truth(true);
	// 						} else {
	// 							truth(false);
	// 						}

	// 					},function(){
	// 						cb(null)
	// 					})
	// 				})
	// 			})
	// 		}
	// 	},function(){
	// 		console.log('double doneskis')
	// 	})
	// });
	this.getTeams(function(args){

	
		this.getPlayers(self.teams[0].team_key,function(){
			async.eachSeries(this.players, function(player,cb){
				// if (player.status){
					console.log(player.name.full/* +" is currently "+player.status*/)
					new Player(player,function(args){
						// this.checkoutTeam(true, function(err,replacements){
						// 	if (!err && replacements.length > 0){
						// 		async.eachSeries(replacements,function(replacement,cbi){
						// 			console.log(replacement.name.full+" ("+replacement.eligible_positions.position+")"+" is available. his bye week is "+replacement.bye_weeks.week)
						// 			cbi()
						// 		},function(){cb()})
						// 	} else if (!err && replacements.length == 0){
						// 		console.log('Uh-oh. theres no one to replace him with')
						// 		cb()
						// 	} else {
						// 		console.log(err)
						// 		cb()
						// 	}
						// })
						this.calcIFS(function(args){
							console.log(this.ifs);
							cb();
						})
					})
					
				//}
			},function(){
				console.log('double doneskis')
			})
		});
	})
})