var models = require(__dirname + '/../src/models');
var config = require(__dirname + '/../src/config');
var assert = require('assert');
var util = require('util');
var log = require('log4js').getLogger('League-test');
var ObjectID = require('mongodb').ObjectID;
var TEST_CASE_ID = config.test.userID;


describe("League",function(){
	describe("#findByOwner",function(){
		it("Should return an array of leagues owned by the use",function(done){
			models.league.findByOwner(TEST_CASE_ID,function(err,result){
				if (err)
					throw err;
				assert.ok(Object.prototype.toString.call(result) == '[object Array]',"Result is not an array!");
				assert.ok(result.length > 0,"Result is an empty array!");
				done();
			});
		});
	});
});
