var redis = require('redis'),
	client = redis.createClient();

client.on("subscribe",function(channel,count){
	console.log('someone subscribed to '+channel)
})

var update = function(){
	setInterval(function(){
		client.publish('test-stream', 'heres a message '+Math.random());
		console.log('running')
	},5000)
}

update();