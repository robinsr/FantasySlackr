var redis = require('redis'),
	subClient = redis.createClient(),
	pubClient = redis.createClient(),
	databaseUrl = "fantasyslackr",
	collections = ["users", "players", "teams", "metadata", "leagues", "activity"],
	db = require("mongojs").connect(databaseUrl, collections),
	utils = require('util'),
	events = require('events');

var subscribeChannel = 'new-yahoo-request';
var publishChannel = 'finished-yahoo-request';

var state = 'idle';
var stateEmitter = new events.EventEmitter();

stateEmitter.on('active', function(){
	if (state == 'idle'){
		console.log('requestModule going active');
		state = 'active';
		processRequests();
	}
});

stateEmitter.on('idle',function(){
	if (state == 'active'){
		console.log('requestModule going idle');
		state = 'idle'
	}
});

function processRequests(){
	if (state == 'active'){
		setTimeout(function(){
		db.activity.findOne({status: "requested"},function(err,result){
			if (err){
				console.log('db find error - requestModule')
			}
			if (!result) {
				stateEmitter.emit('idle')
			} else {
				db.activity.update(result,{status: 'request processed'},function(err){
					if (err){
						console.log('db update error - requestModule')
					}
					console.log('processed')
					pubClient.publish(publishChannel, 'new request processed')
				});
				processRequests();
			}
		})
		},1200)
	} else {
		console.log('requestModule finished all entries')
	}
	
}

subClient.on("message",function(channel,message){
	stateEmitter.emit('active')
});

subClient.subscribe(subscribeChannel);