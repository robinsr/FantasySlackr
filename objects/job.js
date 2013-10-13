var redis = require('redis'),
	client = redis.createClient(),
	databaseUrl = "fantasyslackr",
	collections = ["users", "players", "teams", "metadata", "leagues", "activity", "queue"],
	db = require("mongojs").connect(databaseUrl, collections),
	objectId = require('mongodb').ObjectID,
	utils = require('util'),
	async = require('async'),
	appErr = require('../util/applicationErrors');

var newRequestChannel = 'new-yahoo-request';
var processedRequestChannel = 'finished-yahoo-request';

/*
 * Object representing individual job to be queued and processed
 * @param opt: object. REQUIRED. type (string), message (string), priority (string), player(object), url(string), xml(string);
 * @param uo: object. REQUIRED. User object
 *
 */
var Job = function(opt){
	var self = this;

	self.created_on = new Date();
	self.processed_on = null;
	self.type = opt.type; 
	self.action = opt.action;
	self.message = opt.message;
	self.priority = opt.priority;
	self.player = opt.player;
	self.url = opt.url;
	self.xml = opt.xml;


	self.status;
	if (opt.status){
		self.status = opt.status;
	} else {
		self.status = "unprocessed";
	}

	self.owner;
	if (opt.owner){
		self.owner = opt.owner
	} else if (opt.player.owner){
		self.owner = opt.player.owner._id;
	} else {
		new appErr.game("Job object has no owner");
	}

	self._id;
	if (opt._id) {
		self._id = new objectId(opt._id.toString());
	} else {
		self._id = new objectId();
	}
	
}

/*
 * Adds the job to job queue and emits "new-yahoo-request" to activiate requestModule
 *
 *
 */

Job.prototype.init = function(next){
	console.log(this)
	db.queue.insert(this,function(err){
		if (err){
			next(new appErr.database('Insertion error'))
		} else {
			client.publish(newRequestChannel, 'new request generated');
			next(null);
		}
	})
}

/*
 * Updates the job in queue to status "processed" meaning its ready to be synced with the user's record
 *
 *
 */

Job.prototype.markAsProcessed = function(next){
	this.status = 'request processed';
	this.processed_on = new Date();
	db.queue.save(this,function(err,result){
		if (err){
			next(new appErr.database('Update error'))
		} else {
			client.publish(processedRequestChannel, 'new request processed')
			next(null)
		}
	});
}

/*
 * Syncs the job with the user's record
 *
 *
 */

Job.prototype.sync = function(next){
	db.activity.insert(this,function(err){
		if (err){
			next(new appErr.database('Insertion error'))
		} else {
			next(null);
		}
	})
}

/*
 * Resaves the job in the queue with new properties 
 *
 *
 */

Job.prototype.save = function(next){
	db.queue.save(this,function(err,result){
		if (err){
			next(new appErr.database('Update error'))
		} else {
			client.publish(processedRequestChannel, 'new request processed')
			next(null)
		}
	});
}

/*
 * Removes the processed job from the queue
 *
 *
 */

Job.prototype.destroy = function(next){
	db.queue.remove({_id: this._id},function(err){
		if (err){
			next(new appErr.database('Remove error'))
		} else {
			next(null);
		}
	})
}

module.exports.Job = Job;