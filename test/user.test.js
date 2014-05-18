var models = require(__dirname + '/../src/models');
var config = require(__dirname + '/../src/config');
var assert = require('assert');
var util = require('util');
var log = require('log4js').getLogger('User-test');
// test case
var myUser = models.user.create();
var TEST_CASE_INFO =  { name: 'name',
  _id: config.test.userID,
  email: 'email',
  initial_setup: 'complete',
  pass: 'd916c427b4126aefef448ce2230d5f72',
  salt: 'dHlLMUCJseB8fBx8D29UXAKnAoCLF4vT',
  leagues: [],
  teams: [],
  players: [],
  activity: [],
  access_token: 'A=azvhQvqb5F8W3aBOuCpzchNq7YbeNtRAu2X2jOyuK11Br.AQt0.ovQAJ_u_YQIfaI6_WxSz..B3SwQ.OQPnWXKloVVnOuAEzTGXV3hTj569GckR4QTkVb2p9.viGeUvvCW51gt0p78L9nO6AUOvOu3fCRwovqXpX3rDbv6SNkBHn2H4SEnPiAfHbfVJlxyQp30dH3wK8Eyy8TqbcbmeyNpxMUkACOOutFwVXLwMhy5mStB2mwoWV5hhDrsx_H6go9G5G9b.Dfih2r1ZMA_LGFvJu2YG9B6BI0e3Pe5YbtxYtYZdjlmVb9VeAq6IKb6fzxygExW513_TOCCnati3hqOkHb76QI1xjKpwtPofz2NvztkdZg3_XqEXKio.GT2qAfrpNHeD2fvFWzz9Ym4GbrpPU6eeD8jdD2wSHj0jhe30yNbcTmV9pf385S3RYuC18arwJl3m3TGyYNPn6RJes6iC1mWKLUzFdJm8c.22FCqzN1q_0Mk3V1rmAUSeqi2Lb2WBGQXbUCcFn4h4pwog70Cf6Ota63uqv.nujm1NAl6_jZdm8XbqWB1wnpWWyzT_w.vQn_HKizOOcvlgUgGAQg.LoYIIw_o.lNLT8DZyXl1q7432gT66iruuI.B2OPx24CU_nwdXqDDtdTb1c_6jGKzCtRMrSwkTB_XWrRItMHzDbL_KTwX8hULCxUIn2wwL9DBYw8ufH5Zq.09nNJ8PUsSlLJ10EeXhBHVLUOEkDPAPhtL5g_8WuxZZ6i0vo9a45NgdzEHgcytwO7eCQR6PoyFUbEhIG3.FGHyND_DfNb8g4RicSw2cWk1MF',
  access_token_expires: 1390088769970,
  access_token_secret: '49ae20581331e94f8818a9b4e9db5376f854f54f',
  guid: config.test.guid,
  session_handle: 'AMcX1lHhwyK6Whcvib8LhuK8jqNP39APb1r7AoUJh5El_D3sAzsXkcg-',
  session_handle_expired: null,
  current_login: null,
  request_token: null,
  request_verifier: null,
  request_token_secret: null,
  xoauth_request_auth_url: null,
};

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
		it('Should return a json string of the user', function (done) {
			models.user.findById(TEST_CASE_ID,function(err,result){
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
});