var models = require(__dirname + '/../src/models');
var config = require(__dirname + '/../src/config');
var ObjectId = require('mongodb').ObjectID;
var assert = require('assert');
var util = require('util');
var log = require('log4js').getLogger('Player-test');

var TEST_PLAYER = {
    settings : {
        never_drop : true,
        start_if_probable : true,
        start_if_questionable : false
    },
    player_key : "314.p.25741",
    player_id : "25741",
    name : {
        full : "Doug Martin",
        first : "Doug",
        last : "Martin",
        ascii_first : "Doug",
        ascii_last : "Martin"
    },
    status : "O",
    editorial_player_key : "nfl.p.25741",
    editorial_team_key : "nfl.t.27",
    editorial_team_full_name : "Tampa Bay Buccaneers",
    editorial_team_abbr : "TB",
    bye_weeks : {
        week : "5"
    },
    uniform_number : "22",
    display_position : "RB",
    headshot : {
        url : "http://l.yimg.com/iu/api/res/1.2/cswYGKCvMEi3DiKAAdW9dQ--/YXBwaWQ9eXZpZGVvO2NoPTg2MDtjcj0xO2N3PTY1OTtkeD0xO2R5PTE7Zmk9dWxjcm9wO2g9NjA7cT0xMDA7dz00Ng--/http://l.yimg.com/j/assets/i/us/sp/v/nfl/players_l/20120913/25741.jpg",
        size : "small"
    },
    image_url : "http://l.yimg.com/iu/api/res/1.2/cswYGKCvMEi3DiKAAdW9dQ--/YXBwaWQ9eXZpZGVvO2NoPTg2MDtjcj0xO2N3PTY1OTtkeD0xO2R5PTE7Zmk9dWxjcm9wO2g9NjA7cT0xMDA7dz00Ng--/http://l.yimg.com/j/assets/i/us/sp/v/nfl/players_l/20120913/25741.jpg",
    is_undroppable : "0",
    position_type : "O",
    eligible_positions : {
        position : "RB"
    },
    has_player_notes : "1",
    has_recent_player_notes : "1",
    selected_position : {
        coverage_type : "week",
        week : "10",
        position : "RB"
    },
    owner : new ObjectId(config.test.userID),
    team_key : "314.l.348736.t.1",
    retrieved : 1383795755009,
    _id : new ObjectId()
};

var TEST_USER_GUID = config.test.guid;

var myPlayer;

describe('Player', function (){
	describe("#save",function(){
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
	describe("#oauthContext",function(){
		it("Should get the player's owner's oauth data",function(){
			myPlayer.oauthContext(function(err,oauth){
				assert.ok(oauth, "Returned oauth is null!");
				assert.equal(oauth.tokenDetails.guid,TEST_USER_GUID);
			});
		});
	});
	describe.skip("#get()",function(){
		it("Should get the test xml and return a JS object",function(done){
			var url = "playerGetTest";
			myPlayer.get(url,function(err,data){
				if (err)
					throw err;
				log.debug(data);
				assert.equal(data.message['#'],"true");
				done();
			});
		});
	});
	describe.skip("#getLatestPosition",function(){
		it("Should return XML describing the current poistion of the player",function(done){
			this.timeout(5000);
			myPlayer.getLatestPosition(function(err){
				if (err)
					throw err;
				done();
			});
		});
	});
	describe("#getLatestStats",function(){
		it("Should return XML describing the current stats of the player",function(done){
			this.timeout(5000);
			myPlayer.getLatestStats(function(err){
				if (err)
					throw err;
				done();
			});
		})
	})
	describe.skip("#moveToStart",function(){
		it("Should ")
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