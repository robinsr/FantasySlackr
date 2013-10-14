var util = require('util')

var AbstractError = function (msg, constr) {
	Error.captureStackTrace(this, constr || this)
	this.message = msg || 'Error'
}
util.inherits(AbstractError, Error)
AbstractError.prototype.name = 'Abstract Error'

var DatabaseError = function (msg) {
	DatabaseError.super_.call(this, msg, this.constructor)
}
util.inherits(DatabaseError, AbstractError)
DatabaseError.prototype.name = 'Database Error'

var GameError = function (msg) {
	GameError.super_.call(this, msg, this.constructor)
}
util.inherits(GameError, AbstractError)
GameError.prototype.name = 'Game Logic Error'

var OauthError = function (msg) {
	// appMonitor.sendMessage('error','oa module errored at getToken (line 58) '+utils.inspect(error));
	// appMonitor.sendMessage('error','oa module errored at getToken (line 80) '+utils.inspect(error));
	OauthError.super_.call(this, msg, this.constructor)
}
util.inherits(OauthError, AbstractError)
OauthError.prototype.name = 'Oauth Error'

var UserError = function (msg) {
	UserError.super_.call(this, msg, this.constructor)
}
util.inherits(UserError, AbstractError)
UserError.prototype.name = 'User Error'

module.exports = {
	database: DatabaseError,
	game: GameError,
	oauth: OauthError,
	user: UserError
}