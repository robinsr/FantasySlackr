var models = require(__dirname + '/../src/models');
var config = require(__dirname + '/../src/config');
var assert = require('assert');
var util = require('util');
var log = require('log4js').getLogger('User-test');
// test case
var myUser = models.user.create();
var TEST_CASE_INFO = require(__dirname + "/data/user")

var TEST_CASE_ID = config.test.userID;
describe('User', function () {
	describe('#create()', function () {
		it('Should create a user object', function () {
			assert.equal(myUser.initial_setup, 'incomplete');
		});
	});
	describe('#save()', function () {
		it('Should sucessfully save it', function (done) {
			myUser.save(function (err) {
				if (err)
					throw err;
				done();
			});
		});
		it('Should verify the save', function (done) {
			models.user.findById(myUser._id, function (err, result) {
				if (err)
					throw result;
				assert.equal(myUser.name, result.name);
				done();
			});
		});
	});
	describe("#doesNameExist",function(){
		it("Should check to see if name is taken in db",function(done){
			models.user.doesNameExist(config.test.username,function(err,exists){
				if (err)
					throw err;
				assert.ok(exists, "User's name should exists in mongo");
			});
			done();
		});
	});
	describe('#load()', function () {
		it('Should load the test case data', function () {
			myUser = models.user.load(TEST_CASE_INFO);
			for (var n in TEST_CASE_INFO) {
				assert.equal(myUser[n], TEST_CASE_INFO[n]);
			}
		});
	});
	describe("#getOauthContext",function(){
		it("Should create an oauth object with the correct credentials",function(){
			var oauth = myUser.getOauthContext();
			var copy = ["request_token","request_verifier","request_token_secret","xoauth_request_auth_url","access_token","access_token_secret","access_token_expires","session_handle","session_handle_expires","guid"];
			copy.forEach(function(c){
				//log.debug(c,oauth.tokenDetails[c],myUser[c]);
				assert.equal(oauth.tokenDetails[c],myUser[c], c+" does not match!");
			});
		});
	});
	describe('#getAllGameData()', function () {
			models.user.findById(TEST_CASE_ID,function(err,result){
		it('Should return a json string of the user', function (done) {
				if (err)
					throw err;
				if (!result)
					throw new Error("Test user not found with id "+TEST_CASE_ID);
				myUser = models.user.load(result);
				myUser.getAllGameData(function(err,result){
					if (err)
						throw err;
					var fields_to_verify = ['players','teams','leagues','activity'];
					fields_to_verify.forEach(function(n){
						var type = Object.prototype.toString.call(myUser[n]);
						assert.ok(type == '[object Array]', n + " is not an array!");
						assert.ok(myUser[n].length > 0, n + " is an empty array!");
					});
					done();
				});
			});
		});
	});
	describe("#getPlayers",function(){
		it("Should return an array of the user's players",function(done){
			myUser.getPlayers(function(err,result){
				if (err)
					throw err;
				assert.ok(Object.prototype.toString.call(result) == '[object Array]',"Result is not an array!");
				assert.ok(result.length > 0,"Result is an empty array!");
				done();
			});
		});
	});
	describe("#getLeagues",function(){
		it("Should return an array of the user's leagues",function(done){
			myUser.getLeagues(function(err,result){
				if (err)
					throw err;
				assert.ok(Object.prototype.toString.call(result) == '[object Array]',"Result is not an array!");
				assert.ok(result.length > 0,"Result is an empty array!");
				done();
			});
		});
	});
	describe("#getTeams",function(){
		it("Should return an array of the user's teams",function(done){
			myUser.getTeams(function(err,result){
				if (err)
					throw err;
				assert.ok(Object.prototype.toString.call(result) == '[object Array]',"Result is not an array!");
				assert.ok(result.length > 0,"Result is an empty array!");
				done();
			});
		});
	});
	describe("#getActivity",function(){
		it("Should return an array of the user's teams",function(done){
			myUser.getActivity(function(err,result){
				if (err)
					throw err;
				assert.ok(Object.prototype.toString.call(result) == '[object Array]',"Result is not an array!");
				assert.ok(result.length > 0,"Result is an empty array!");
				done();
			});
		});
	});
	describe('#remove()', function () {
		it('Should remove the object', function (done) {
			myUser.remove(function (err) {
				if (err)
					throw err;
				done();
			});
		});
		it('Should verifiy remove works by not finding the record', function (done) {
			models.user.findById(myUser._id, function (err,result) {
				if (!err)
					throw new Error("User was not removed from mongo");
				done();
			});
		});
	});
});
