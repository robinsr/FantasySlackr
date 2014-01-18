var http = require('http');

var sendMessage = function(level,message){
    if (level && message){
        message = message.replace(/\"/g,'');
        var postData = {
        	level: level,
        	message: message
        }
        var postOptions = {
            host: 'localhost',
            port: 8136,
    	path: '/fantasyslackr',
            method: 'POST',
            headers: {
                'Content-Type' :'application/json'
            }
        };
        var keyReq = http.request(postOptions,function(errorRes){
            }).on('end',function(){
            }).on('data',function(c){
            }).on('error',function(er){
                console.log('appMonitor Error - '+er);
            });
        keyReq.write(JSON.stringify(postData));
        keyReq.end();
    }
}

module.exports.sendMessage = sendMessage;
