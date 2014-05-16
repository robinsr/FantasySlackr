var assert = require("assert");

describe("ModelIndex",function(){
	it("Should import models without namespace/requires problmes",function(done){
		var models = require(__dirname+"/../src/objects");


		var myplayer = models.player.create({retrieved:true},function(){
			assert.equal(typeof this.save, "function")
			console.log(this.save.toString())
			done()
		})
	})
})
