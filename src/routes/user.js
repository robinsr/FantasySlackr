var models = require(__dirname + "/../models");
var async = require('async');

exports.create = function(req,res){}
exports.login = function(req,res){
	async.waterfall([
		function (cb){
			models.user.findByName(req.body.uname,function(err,result){
				if (err) cb(err)
				else if (!result) cb("User not found");
				else cb(null,result);
			});
		},
		function (user, cb){
			var u = models.user.load(user);
			u.makeSession(function(err){
				if (err) cb("Error making session");
				else cb(null, u);
			});
		},
		function (user, cb){
			user.getAllGameData(function(err){
				if (err) cb("Error getting game data");
				else cb(null, user.safeData());
			});
		}
	],function(err,result){
		var statusCode = !result ? err? 500 : 400 : 200;
		res.send(statusCode,result);
	});
}
exports.update = function(req,res){}
exports.del = function(req,res){}