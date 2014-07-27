var models = require(__dirname + '/../src/models');
var assert = require('assert');
var util = require('util');
var aoo = require(__dirname + '/server');
var log = require('log4js').getLogger('Ouath-test');
var testCase, testUser, old_access;
var TEST_CASE_INFO = require(__dirname + "/data/user");


describe('Oauth', function () {
  describe('#getToken()', function () {
    before(function () {
      testCase = models.oauth.create();
      assert.equal(testCase.name, 'oauth');
    });
    it('Should get a request token from yahoo', function (done) {
      testCase.getToken(function (err) {
        if (err)
          throw err;
        assert.ok(testCase.tokenDetails.request_token, 'No token');
        assert.ok(testCase.tokenDetails.request_verifier, 'No verifier');
        assert.ok(testCase.tokenDetails.xoauth_request_auth_url, 'No redirect url');
        done();
      });
    });
  });
  describe('refresh', function () {
    before(function (done) {
      testCase = models.user.load(TEST_CASE_INFO);
      testCase.save(function(err){
        if (err) throw err;
        assert.ok(testCase.access_token, 'Test user has null access token');
        old_access = testCase.access_token;
        done();
      })
    });
    it('Should refresh the test users token', function (done) {
      testCase.refreshToken(function (err) {
        if (err)
          throw err;
        assert.ok(testCase.access_token !== old_access, 'Test users access token was not refreshed');
        done();
      });
    });
  });
});
