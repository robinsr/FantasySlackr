var crypto = require('crypto'),
	slackr_utils =  require('../slackr_utils'),
	appErr = require('../util/applicationErrors'),
	databaseUrl = "fantasyslackr",
	collections = ["users", "players", "teams", "metadata", "leagues", "activity", "queue"],
	db = require("mongojs").connect(databaseUrl, collections),
	objectId = require('mongodb').ObjectID,
	oa = require('./oauth'),
 	utils = require('util'),
 	async = require('async'),
 	extend = require('extend');

var User = function(opt){
	this.name = opt.uname;
	this.email = opt.uemail;
	this.pass = null;
	this.salt = null;
}

/*
 * Saves the state of the user to mongo
 *
 */
User.prototype.save = function(next) {
	db.users.insert(this,function(err){
		if (err){
			next(new appErr.user("this is a user error!"));
		} else {
			next()
		}
	})	
};

/**
 *  Creates user: 
 *  Checks for taken username,
 *  Hashes and salts password,
 *  Gets oauth tokens,
 *  saves
 */
User.prototype.create = function(opt,next) {
	var self = this;
	db.users.findOne({name:self.name},function(err,result){
		if (err){
			next(new appErr.user('Error accesing user database'));
		} else if (result){
			next(new appErr.user('User Account Already Exists'));
		} else {
			var hash_salt = slackr_utils.requestHashAsync(32);
		    var hashed_pass_and_salt = crypto.createHash('md5').update(opt.upass + hash_salt).digest('hex');

		    self.pass = hashed_pass_and_salt;
		    self.salt = hash_salt;

		    var oauth = new oa.Oauth({})

			async.series([
			function(cb){
				oauth.getToken(function(err){cb(err)})
			},
			function(cb){
				extend(self,oauth.saveable);
				cb(null);
			}
			],
			function(err){
				console.log(self);
				self.save(function(err){
					next(err)
				});
			})
		}
	});
	
};

/**
 *  Deactivates user account
 */
User.prototype.deactivate = function(next) {
	// body...
};


module.exports.User = User;

