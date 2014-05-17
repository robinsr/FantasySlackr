var redis = require('redis'), subClient = redis.createClient(), pubClient = redis.createClient(), databaseUrl = 'fantasyslackr', collections = [
    'users',
    'players',
    'teams',
    'metadata',
    'leagues',
    'activity',
    'queue'
  ], db = require('mongojs').connect(databaseUrl, collections), utils = require('util'), events = require('events'), Job = require('../objects/job');
var subscribeChannel = 'finished-yahoo-request';
var state = 'idle';
var stateEmitter = new events.EventEmitter();
stateEmitter.on('active', function () {
  if (state == 'idle') {
    console.log('syncModule going active');
    state = 'active';
    processRequests();
  }
});
stateEmitter.on('idle', function () {
  if (state == 'active') {
    console.log('syncModule going idle');
    state = 'idle';
  }
});
function processRequests() {
  if (state == 'active') {
    db.queue.findOne({ status: 'request processed' }, function (err, result) {
      if (err) {
        console.log('db find error - syncModule');
      }
      if (!result) {
        stateEmitter.emit('idle');
      } else {
        var job = new Job.Job(result);
        // logic for updating user records
        job.sync(function (err) {
          job.destroy(function (err) {
            processRequests();
          });
        });
      }
    });
  } else {
    console.log('syncModule finished all entries');
  }
}
subClient.on('message', function (channel, message) {
  stateEmitter.emit('active');
});
subClient.subscribe(subscribeChannel);