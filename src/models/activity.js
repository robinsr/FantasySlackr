var databaseUrl = 'fantasyslackr';
var collections = [
    'activity'
  ];
var db = require('mongojs').connect(databaseUrl, collections);
var ObjectID = require('mongodb').ObjectID;

module.exports = function(e){
    return e.define('activity', {
		_id : null,
		name : null,
		date : null,
		type : null,
		message : null,
		owner: null
    },{
    	findByOwner: function(owner, next){
    		if (typeof owner == 'string')
    			owner = new ObjectID(owner);
    		db.activity.find({ owner: owner }, function (err, result){
    			next(err,result);
    		});
    	},
    	findById: function(id, next){
    		if (typeof id == 'string')
    			id = new ObjectID(id);
    		db.activity.find({ _id: id }, function (err, result){
    			next(err,result);
    		});
    	}
    },{
    	save: function(next){
    		db.activity.save(this,function(err){
    			next(err);
    		});
    	},
    	remove: function(next){
    		db.activity.remove({_id: this._id},function(err,result){
    			next(err,result);
    		});
    	}
    });
};