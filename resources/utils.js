// =============  Custom jQuery shake animation =================

$(function(){
    $.fn.shake = function(){
        this.animate({
            marginLeft: '-6px'
            }, 30, function (el) {
            $(this).animate({
            marginLeft: '6px'
            }, 30, function (el) {
            $(this).animate({
            marginLeft: '0'
            }, 30)
            });
        });
    }
});


// ===========  Utils module =============
var utils = (function(){
    return {
        // issues all ajax calls to server
        issue : function (command, Json, cb) {
            console.log('issueing')
            var url = command;
            if (Json == null){
            // request is a get
                var error = null;
                $.ajax({
                    url: url,
                    type: 'GET',
                    error: function(dat){
                        error == true
                    },
                    complete: function(dat){
                        cb(null,dat.status,dat.responseText);
                        return
                    }
                });
            } else {
                $.ajax({
                    url: url,
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify(Json),
                    error: function(dat){
                        error == true;
                    },
                    complete: function(dat){
                        cb(null,dat.status,dat.responseText);
                    return
                    }
                }); 
            }   
        }
    }
})();
