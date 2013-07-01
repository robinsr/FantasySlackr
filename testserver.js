var http = require('http').createServer(me);



function me(){
	
var exec = require('child_process').exec;
exec('pwd', function callback(error, stdout, stderr){
    console.log(stdout)
    console.log("\n");
    console.log(stderr)
    console.log("\n");
});
}

http.listen(8133)