var models = require(__dirname+"/../src/models");
var assert = require("assert");
var util = require('util');


// test case
var myUser = models.user.create();

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

describe("User",function(){

	describe("#create()",function(){
		it("Should create a user object",function(){
			assert.equal(myUser.initial_setup, "incomplete")
		})
	})

	describe("#save()",function(){
		it("Should sucessfully save it",function(done){
			myUser.save(function(err){
				if (err) throw err
				done()
			})
		});
		it("Should verify the save",function(done){
			models.user.findById(myUser._id,function(result){
				if (util.isError(result)) throw result
				assert.equal(myUser.name, result.name)
			done()
			})
		})
	})

	describe("#remove()",function(){
		it("Should remove the object",function(done){
			myUser.remove(function(err){
				if (err) throw err
				done()
			})
		})
		it("Should verifiy remove works by not finding the record",function(done){
			models.user.findById(myUser._id,function(result){
				if (!util.isError(result)) throw result
				done()
			})
		})
	})

	describe("#load()",function(){
		it("Should load the test case data",function(){
			myUser = models.user.load(TEST_CASE_INFO);
			for (n in TEST_CASE_INFO){
				assert.equal(myUser[n], TEST_CASE_INFO[n]);
			}
		})
	})

	describe("#getAllGameData()",function(){
		it("Should return a json string of the user",function(done){
			myUser.getAllGameData(function(result){
				if (util.isError(result)) throw result
				for (n in TEST_CASE_INFO){
					if (Object.prototype.toString.call(TEST_CASE_INFO[n]) == "[object Array]"){
						assert.equal(TEST_CASE_INFO[n], result[n])
					}
				}
				done()
			})
		})
	})
})