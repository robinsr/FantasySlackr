var http = require('http');

var sendMessage = function(level,message){
    var postData = {
    	level: level,
    	message: message
    }
    var postOptions = {
        host: '127.0.0.1',
        port: 8135,
		path: 'fantasyslackr',
        method: 'POST',
        headers: {
            'Content-Type' :'application/json'
        }
    };
    var keyReq = http.request(postOptions,function(res){
    	res.on('data',fuction(c){});
        res.on('end',function(){
            console.log("sent to App Monitor: ",level,message);
        });
    });
    keyReq.write(JSON.stringify(postData));
    keyReq.end();
}

module.exports.sendMessage = sendMessage;
