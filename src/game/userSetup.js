var redis = require('redis'), client = redis.createClient(), util = require('util'), Team = require('../objects/team').Team;
var subscribeChannel = 'new-setup-request';
client.on('message', function (channel, m) {
  var message = JSON.parse(m);
  console.log(util.inspect(message));
  message.keys.forEach(function (key) {
    new Team({
      owner: message.user,
      team_key: key
    }, function (args) {
      this.save(function () {
        console.log('team setup');
      });
    });
  });
});
client.subscribe(subscribeChannel);