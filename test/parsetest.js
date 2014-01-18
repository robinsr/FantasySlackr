var parser = require('libxml-to-js');
var utils = require('util');
var fs = require('fs');
var extend = require('extend');

fs.readFile('./test.xml',function(err,response){
	var xml = response.toString();

	var m = xml.match(/<description>(.*)<\/description>/);

	console.log(m)
})


