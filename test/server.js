var log = require('log4js').getLogger('Teset Server');
var templates = require(__dirname+"/../src/xml/templates");
var express = require('express');
var app = express();
var testport = 3001;
app.use(app.router);
app.get('*',function(req,res){
	res.send(templates._success({}));
})
app.listen(testport,function(){
	log.debug("Test server listening on %d",testport);
});
module.exports = app;