var models = require(__dirname+"/../src/models");
var assert = require('assert');
var util = require('util');
var aoo = require(__dirname + '/server');

var testCase, testUser, old_access;

var TEST_CASE_INFO = { 
	name: "Test User",
	email: "testuser@test.com",
	pass: "12345",
	salt: "abcde",
	teams: ["test team"],
	leagues: ["test league"],
	players: ["test player"],
	activity: ["test activity"]
}



describe("Oauth",function(){
	describe("#create()",function(){
		it("Should return a new oauth object",function(){
			testCase = models.oauth.create();
			assert.equal(testCase.name, "oauth")
		})
	});
	describe("#getToken()",function(){
		it("Should get a request token from yahoo",function(done){
			testCase.getToken(function(err){
				if (err) throw err;
				assert.ok(testCase.tokenDetails.request_token != null, "No token");
				assert.ok(testCase.tokenDetails.request_verifier != null, "No verifier");
				assert.ok(testCase.tokenDetails.xoauth_request_auth_url != null, "No redirect url");
				done();
			})
		})
	});
	describe(" - Creating test user - ",function(){
		it("Should create a test user",function(done){
			testUser = models.user.load(TEST_CASE_INFO);
			assert.ok(testUser.access_token != null, "Test user has null access token");
			old_access = testUser.access_token;
			done();
		})
	});

	describe("refresh",function(){
		it("Should refresh the test users token",function(done){
			testUser.refreshToken(function(err){
				if (err) throw err;
				assert.ok(testUser.access_token != old_access, "Test users access token was not refreshed");
				done()
			})
		})
	})
})