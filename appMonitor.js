var http = require('http');

var sendMessage = function(level,message){
    console.log('starting error report')
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
        console.log('starting request');
        console.log(keyReq.url);
        }).on('end',function(){
            console.log("sent to App Monitor: ",level,message);
        }).on('data',function(c){
            console.log('got error report errorRes, data')
        }).on('error',function(er){
            console.log('appMonitor Error - '+er);
        });
    keyReq.write(JSON.stringify(postData));
    keyReq.end();
}

module.exports.sendMessage = sendMessage;
