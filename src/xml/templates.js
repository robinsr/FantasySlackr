var handlebars = require('handlebars');
var fs = require('fs');
var templates = {};

var files = fs.readdirSync(__dirname).filter(function(file){
	return file.match(/\.xml$/);
});

files.forEach(function(file){
	var source = fs.readFileSync(__dirname + "/" + file);
	var filename = file.replace(".xml","");
	templates[filename] = handlebars.compile(source.toString());
});

module.exports = templates;
