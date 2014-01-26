var assert = require("assert");

describe("ModelIndex",function(){
	it("Should import models without namespace/requires problmes",function(done){
		var models = require(__dirname+"/../src/objects/index");


		var myplayer = new models.player({retrieved:true},function(){
			assert.equal(typeof this.save, "function")
			done()
		})
	})
})
