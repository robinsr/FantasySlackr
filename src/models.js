/**
 * Imports models in one file so they can call methods of each
 */

var exp = require(__dirname+"/exporter");

var exporter = new exp();

module.exports.player = exporter.import(__dirname+"/models/player");