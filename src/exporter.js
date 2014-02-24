objectId = require('mongodb').ObjectID;
function a(){}

a.prototype.define = function(objName, defaultProps, classMethods, instanceMethods){
	var returnObj = classMethods;
	returnObj.create = function(){
		var defaultCopy = {
			name: { value: objName, enumerable: true, writable: true },
			_id: { value: new objectId(), enumerable: true, writable: true }
		}
		for (n in defaultProps){
			defaultCopy[n] = { value: defaultProps[n], enumerable: true, writable: true }
		}
		return Object.create(instanceMethods || {},defaultCopy)
	}
	returnObj.load = function(options){
		var defaultCopy = {
			name: { value: objName }
		}
		for (n in defaultProps){
			defaultCopy[n] = { value: options[n] || defaultProps[n], enumerable: true, writable: true }
		}
		return Object.create(instanceMethods || {},defaultCopy)
	}
	return returnObj
}

a.prototype.import = function(path){
	var newMod = require(path);;
	return newMod(this);
}

module.exports = a