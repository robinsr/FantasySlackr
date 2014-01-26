module.exports = function(exporter){
	return exporter.define("hello",{
		create:function(){
			console.log("I am created")
		}
	})
}