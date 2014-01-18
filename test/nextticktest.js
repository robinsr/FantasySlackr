var util = require('util')

function async(next){
	console.log('async running '+ new Date().getTime())
	process.nextTick(function(){
		next();
	})
}
function notAsync(next){
	console.log('not async running '+ new Date().getTime())
	next()
}
async(function(){
	console.log('async callback '+ new Date().getTime())
})
notAsync(function(){
	console.log('not async callback '+ new Date().getTime())
})
console.log(process.arch, process.platform)
console.log(util.inspect(process.memoryUsage()));