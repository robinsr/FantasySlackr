var log = require('log4js').getLogger('Teset Server');
var templates = require(__dirname+"/../src/xml/templates");
var fs = require('fs');
var http = require('http');
var https = require('https');
var express = require('express');
var app = express();
var testport = 3001;
var privateKey  = fs.readFileSync(__dirname + '/certs/privatekey.pem', 'utf8').toString();
var certificate = fs.readFileSync(__dirname + '/certs/certificate.pem', 'utf8').toString();
var credentials = {key: privateKey, cert: certificate};
app.use(app.router);
// app.post('/get_token',function(res,res){
// 	res.send(templates._oauthToken({}));
// })
// app.post('/get_request_token',function(req,res){
// 	res.send(templates._oauthToken({}));
// })
app.post("*",function(req,res){
	log.debug("POST");
	log.debug(req.url)
})
app.put("*",function(req,res){
	log.debug("PUT");
	log.debug(req.url)
})
app.get('*',function(req,res){
	log.debug("Got a GET")
	res.send(templates._success({}));
})
var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);
httpServer.listen(8080);
httpsServer.listen(8443);

log.debug("Server listening on %s and %s",8080,8443)

module.exports = app;