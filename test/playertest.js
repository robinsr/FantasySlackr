var Player = require('../objects/player').Player,
	databaseUrl = "fantasyslackr",
	collections = ["users", "players", "teams", "metadata", "leagues", "activity", "queue"],
	db = require("mongojs").connect(databaseUrl, collections),
	util = require('util');

// new Player({team_key:"314.l.148766.t.1",player_key:"314.p.8261"},function(args){
// 	if (args.err) console.log(args.err)
// 	this.calcValueToTeam(function(args){
// 		console.log(this.name.full + " " + util.inspect(this.vT))
// 	})
// })

// new Player({team_key:"314.l.348736.t.1",player_key:"314.p.25741"},function(args){
// 	if (args.err) console.log(args.err)
// 	this.calcValueToTeam(function(args){
// 		console.log(this.name.full + " " + util.inspect(this.vT))
// 	})
// })

// new Player({team_key:"314.l.148766.t.1",player_key:"314.p.7751"},function(args){
// 	if (args.err) console.log(args.err)
// 	this.calcValueToTeam(function(args){
// 		console.log(this.name.full + " " + util.inspect(this.vT))
// 	})
// })

new Player({provisional_team_key:"314.l.148766.t.1",player_key:"314.p.7751"},function(args){
	if (args.err) console.log(args.err)
	this.getOwnership(function(args){
		if (args.err) console.log(args.err)
		console.log('done')
	})
})


// db.players.update({team_ley: {$exists: true}},{$rename: {'team_ley':'team_key'}},function(){
// 	console.log('done?');
// 	process.exit();
// })
