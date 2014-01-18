function poop(next,context){
		console.log(arguments)
	if (context){
		next('context good!')
	} else {
		next('no context')
	}
}


poop.call(this,function(message){
	console.log(message)
},"context")