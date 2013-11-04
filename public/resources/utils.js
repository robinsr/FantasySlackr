// =============  Custom jQuery shake animation =================

$(function(){
    $.fn.shake = function(){
        this.animate({
            marginLeft: '-6px',
            marginRight: '6px'
            }, 30, function (el) {
            $(this).animate({
            marginLeft: '6px',
            marginRight: '-6px'
            }, 30, function (el) {
            $(this).animate({
            marginLeft: '0',
            marginRight: '0'
            }, 30)
            });
        });
    }
});


// ===========  Utils module =============
var utils = (function(){
    var username,session;
    var credentials = function(){
        return {uname:username,session:session};
    }
    return {
        // issues all ajax calls to server
        issue : function (method, command, Json, cb) {
            var postdata;
            Json ? postdata = JSON.stringify($.extend(Json, credentials())) : postdata = JSON.stringify(credentials());
            console.log('issueing')
            var url = command;
            var error = false;
            $.ajax({
                url: url,
                type: method,
                contentType: 'application/json',
                data: postdata,
                error: function(dat){
                    error == true;
                },
                complete: function(dat){
                    cb(error,dat.status,dat.responseText);
                return
                }
            }); 
        },
        setCredentials : function(name,sess){
            username = name;session = sess
        }
    }
})();
