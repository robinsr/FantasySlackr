var redis = require('redis'),
	client = redis.createClient();

client.on("message",function(channel,message){
	console.log('message on '+channel)
	console.log(message);
});

client.subscribe('test-stream')