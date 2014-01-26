function a(){}

a.prototype.define = function(objName,methods){
	return methods
}

a.prototype.import = function(path){
	var newMod = require(path);
	return newMod(this)
}

module.exports = a