var models = require(__dirname + '/../src/models');
var assert = require('assert');
var util = require('util');
var aoo = require(__dirname + '/server');
var log = require('log4js').getLogger('Ouath-test');
var testCase, testUser, old_access;
var TEST_CASE_INFO = require(__dirname + "/data/user");

var TEST_CASE_ID = '532de50296f5b0f91c000001';
describe('Oauth', function () {
  describe('#create()', function () {
    it('Should return a new oauth object', function () {
      testCase = models.oauth.create();
      assert.equal(testCase.name, 'oauth');
    });
  });
  describe('#getToken()', function () {
    it('Should get a request token from yahoo', function (done) {
      testCase.getToken(function (err) {
        if (err)
          throw err;
        assert.ok(testCase.tokenDetails.request_token !== null, 'No token');
        assert.ok(testCase.tokenDetails.request_verifier !== null, 'No verifier');
        assert.ok(testCase.tokenDetails.xoauth_request_auth_url !== null, 'No redirect url');
        done();
      });
    });
  });
  describe(' - Creating test user - ', function () {
    it('Should create a test user', function (done) {
      models.user.findById(TEST_CASE_ID, function (err, result) {
        if (err)
          throw err;
        testCase = models.user.load(result);
        assert.ok(testCase.access_token !== null, 'Test user has null access token');
        old_access = testCase.access_token;
        done();
      });
    });
  });
  describe('refresh', function () {
    it('Should refresh the test users token', function (done) {
      testCase.refresh(function (err) {
        if (err)
          throw err;
        assert.ok(testCase.access_token !== old_access, 'Test users access token was not refreshed');
        done();
      });
    });
  });
});
