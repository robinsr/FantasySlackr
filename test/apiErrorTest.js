var Player = require('../objects/player').Player,
    databaseUrl = "fantasyslackr",
    collections = ["users", "players", "teams", "metadata", "leagues", "activity", "queue"],
    db = require("mongojs").connect(databaseUrl, collections),
    util = require('util');

new Player({"player_key" : "314.p.25q741","team_key" : "314.l.148766.t.1"},function(args){
    if (args.err) console.log(args.err)
    this.getLatestXml(function(args){
        console.log(util.inspect(args));
    })
})

