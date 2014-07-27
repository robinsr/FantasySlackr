var models = require(__dirname + '/../src/models');
var config = require(__dirname + '/../src/config');
var ObjectId = require('mongodb').ObjectID;
var assert = require('assert');
var util = require('util');
var log = require('log4js').getLogger('Player-test');

var TEST_PLAYER = require(__dirname + "/data/player");

var TEST_USER_GUID = config.test.guid;

var myPlayer;

describe('Player', function (){
	describe("#save()",function(){
		it("Should create the test player",function(done){
			myPlayer = models.player.load(TEST_PLAYER);
			myPlayer.save(function(err){
				if (err)
					throw wee;
				done();
			});
		});
		it('Should verifiy #save() works', function (done) {
			models.player.findById(myPlayer._id, function (err,result) {
				if (err)
					throw err;
				assert.ok(result, "No result");
				assert.equal(result._id.toString(), myPlayer._id.toString(), "Result id does not match test case!");
				done();
			});
		});
	});
	describe('#findByPlayerAndTeamKey()', function () {
		it('Should find a player with the supplied team and ', function (done) {
			models.player.findByPlayerAndTeamKey(TEST_PLAYER.player_key, TEST_PLAYER.team_key,function(err,result){
				if (err)
					throw err;
				assert.equal(TEST_PLAYER.headshot.url, result.headshot.url); //tests nested property
				done();
			});
		});
	});
	describe("#oauthContext()",function(){
		it("Should get the player's owner's oauth data",function(){
			myPlayer.oauthContext(function(err,oauth){
				assert.ok(oauth, "Returned oauth is null!");
				assert.equal(oauth.tokenDetails.guid,TEST_USER_GUID);
			});
		});
	});
	describe("#get()",function(){
		it("Should get the test xml and return a JS object",function(done){
			if (process.env.NODE_ENV == 'test'){
				var url = "playerGetTest";
				myPlayer.get(url,function(err,data){
					if (err)
						throw err;
					assert.equal(data.message['#'],"true");
					done();
				});
			} else {
				done();
			}
		});
	});
	describe("#getLatestPosition()",function(){
		it("Should return XML describing the current poistion of the player",function(done){
			this.timeout(5000);
			myPlayer.getLatestPosition(function(err){
				if (err)
					throw err;
				done();
			});
		});
	});
	describe("#getLatestStats()",function(){
		it("Should return XML describing the current stats of the player",function(done){
			this.timeout(5000);
			myPlayer.getLatestStats(function(err){
				if (err)
					throw err;
				done();
			});
		});
	});
	describe("#moveToBench()",function(){
		it("Should move the player to bench and return a 200",function(done){
			myPlayer.moveToBench(function(err){
				if (err)
					throw err;
				done();
			});
		});
	});
	describe("#moveToStart()",function(){
		it("Should move the player to starting position and return a 200",function(done){
			myPlayer.moveToStart(function(err){
				if (err)
					throw err;
				done();
			});
		});
	});
	describe("#isBye(currentWeek)",function(){
		it("Should return true or false if this player's nye is currentWeek",function(){
			assert.ok(myPlayer.isBye(5),"isBye() returned incorrect value");
			assert.ok(!myPlayer.isBye(6),"isBye() returned incorrect value");
		});
	});


	// LAST TEST REMOVES THE TEST CASE!
	describe('#remove()', function () {
		it('Should remove the object', function (done) {
			myPlayer.remove(function (err) {
				if (err)
					throw err;
				done();
			});
		});
		it('Should verifiy remove works by not finding the record', function (done) {
			models.player.findById(myPlayer._id, function (err,result) {
				if (err)
					throw err;
				assert.ok(!result || result.length === 0, "Player was not removed from mongo!");
				done();
			});
		});
	});
});
