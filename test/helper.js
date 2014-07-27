/**
 * Module dependencies.
 */

var async = require('async'),
    Expedition = mongoose.model('Expedition'),
    User = mongoose.model('User'),
    Place = mongoose.model('Place')

    /**
     * Clear database
     *
     * @param {Function} done
     * @api public
     */

    exports.clearDb = function(done) {
        async.parallel([

            function(cb) {
                User.collection.remove(cb)
            },
            function(cb) {
                Expedition.collection.remove(cb)
            }
        ], done)
    }
