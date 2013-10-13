var redis = require('redis'),
	subClient = redis.createClient(),
	pubClient = redis.createClient(),
	databaseUrl = "fantasyslackr",
	collections = ["users", "players", "teams", "metadata", "leagues", "activity", "queue"],
	db = require("mongojs").connect(databaseUrl, collections),
	utils = require('util'),
	events = require('events'),
	Job = require('../objects/job');

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
		db.queue.findOne({status: "unprocessed"},function(err,result){
			if (err){
				console.log('db find error - requestModule')
			}
			if (!result) {
				stateEmitter.emit('idle')
			} else {
				var job = new Job.Job(result);

				// logic for routing and completing job

				job.markAsProcessed(function(){
					processRequests();
				});
			}
		})
	} else {
		console.log('requestModule finished all entries')
	}
	
}

subClient.on("message",function(channel,message){
	stateEmitter.emit('active')
});

subClient.subscribe(subscribeChannel);