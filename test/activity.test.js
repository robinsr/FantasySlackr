var models = require(__dirname + '/../src/models');
var config = require(__dirname + '/../src/config');
var assert = require('assert');
var util = require('util');
var log = require('log4js').getLogger('Activity-test');
var ObjectID = require('mongodb').ObjectID;
var TEST_CASE_ID = config.test.userID;

var TEST_CASE_INFO = {
	name : "name",
	date : new Date(),
	type : "test strings",
	message : "test strings",
	owner: new ObjectID(TEST_CASE_ID)
};

var myActivity;

describe("Activity",function(){
	describe("#findByOwner",function(){
		it("Should return an array of activity objects related to the owner",function(done){
			models.activity.findByOwner(TEST_CASE_ID,function(err,result){
				if (err)
					throw err;
				assert.ok(Object.prototype.toString.call(result) == '[object Array]',"Result is not an array!");
				assert.ok(result.length > 0,"Result is an empty array!");
				done();
			});
		});
	});
	describe("#save",function(){
		it("Should save a new activity without error",function(done){
			myActivity = models.activity.load(TEST_CASE_INFO);
			myActivity.save(function(err){
				if (err)
					throw err;
				done();
			});
		});
		it("Should verify the save",function(done){
			models.activity.findById(myActivity._id,function(err,result){
				if (err)
					throw err;
				assert.ok(Object.prototype.toString.call(result) == '[object Array]',"Result is not an array!");
				assert.ok(result.length > 0,"Result is an empty array!");
				done();
			});
		});
	});
	describe("#remove",function(){
		it("Should remove the new activity without error",function(done){
			myActivity.remove(function(err){
				if (err)
					throw err;
				done();
			});
		});
		it("Should verify the remove",function(done){
			models.activity.findById(myActivity._id,function(err,result){
				if (err)
					throw err;
				assert.ok(result.length === 0,"Activity was not removed from mongo!");
				done();
			});
		});
	});
});
