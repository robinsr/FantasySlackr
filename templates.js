var mu = require('mu2')

var invalidSession = function (req,res){
    var d = {
        header: "You're session expired",
        message1: "If you're seeing this a lot, we're probably doing something wrong",
        message2: "<p>Click <a href='/FantasyAutomate'>here</a> to login again</p>"
    }
    var html = ''
    mu.compileAndRender('genericMessagePage.html', d).on('data', function (data) {
        html += data.toString();
    }).on('end', function(){
        res.writeHead(200);
        res.end(html);
        return;
    }); 
} 
    // generic error page with 2 custom messages
var sendErrorResponse = function (res,message1,message2){
    var html = '';
    mu.compileAndRender('errorpage.html',{ message1: message1, message2: message2 }).on('data', function (data) {
        html += data.toString();
    }).on('end', function(){
        res.writeHead(500);
        res.end(html);
    });
}

module.exports.invalidSession = invalidSession;
module.exports.sendErrorResponse = sendErrorResponse;