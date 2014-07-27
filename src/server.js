/**
 * Module dependencies.
 */

var express = require('express'),
    fs = require('fs'),
    passport = require('passport')

    /**
     * Main application entry file.
     * Please note that the order of loading is important.
     */

    // Load configurations
    // if test env, load example file
    var env = process.env.NODE_ENV || 'development';
    var config = require(__dirname + '/config/config')[env];




//     mongoose = require('mongoose')
//
//     // Bootstrap db connection
//     // Connect to mongodb
//     var connect = function() {
//         var options = {
//             server: {
//                 socketOptions: {
//                     keepAlive: 1
//                 }
//             }
//         }
//         mongoose.connect(config.db, options)
// }
// connect()
//
// // Error handler
// mongoose.connection.on('error', function(err) {
//     console.log(err)
// })
//
// // Reconnect when closed
// mongoose.connection.on('disconnected', function() {
//     connect()
// })
//
// // Bootstrap models
// var models_path = __dirname + '/app/models'
// fs.readdirSync(models_path).forEach(function(file) {
//     if (~file.indexOf('.js')) require(models_path + '/' + file)
// })

// bootstrap passport config
require(__dirname + '/config/passport')(passport, config)

var app = express()
// express settings
require(__dirname + '/config/express')(app, config, passport)

// Bootstrap routes
require(__dirname + '/config/routes')(app, passport)

// Start the app by listening on <port>
var port = process.env.PORT || 8128
app.listen(port)
console.log('Express app started on port ' + port)

// expose app
exports = module.exports = app
