var log = require('log4js').getLogger('Teset Server');
var templates = require(__dirname + '/../src/xml/templates');
var fs = require('fs');
var http = require('http');
var express = require('express');
var app = express();
var testport = 3001;
app.use(app.router);
// app.post('/get_token',function(res,res){
// 	res.send(templates._oauthToken({}));
// })
// app.post('/get_request_token',function(req,res){
// 	res.send(templates._oauthToken({}));
// })
app.post('*', function (req, res) {
  log.debug('POST');
  log.debug(req.url);
});
app.put('*', function (req, res) {
  log.debug('PUT');
  log.debug(req.url);
});
app.get('/playerGetTest',function (req, res){
	log.debug('/playerGetTest');
	res.send(templates._success({}));
});
app.get('/fantasy/v2/team/:teamkey/roster/players',function(req,res){
	res.send(templates._roster({}));
});
app.get('/fantasy/v2/player/:playerkey/stats',function(req,res){
	res.send(templates._stats({}));
});
app.get('*', function (req, res) {
  log.debug('Got a GET');
  res.send(templates._success({}));
});
var httpServer = http.createServer(app);
httpServer.listen(testport);
log.debug('Server listening on %s and %s', testport);
module.exports = app;