var http = require('http').createServer(me);


function me(res,req){
	req.end("it worked");
}


http.listen(8133)