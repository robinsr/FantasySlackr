/**
 * Imports models in one file so they can call methods of each
 */
var exp = require(__dirname + '/exporter');
var exporter = new exp();
module.exports.player = exporter.import(__dirname+"/models/player");
module.exports.team = exporter.import(__dirname+"/models/team");
module.exports.user = exporter.import(__dirname + '/models/user');
module.exports.oauth = exporter.import(__dirname + '/models/oauth');
module.exports.activity = exporter.import(__dirname + '/models/activity');
module.exports.league = exporter.import(__dirname + '/models/league');