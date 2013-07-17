var fs = require('fs');

    // handles static content - usually passed off to nginx after dev is complete
exports.serveStatic = function(req, res) {
    var filePath = '.' + req.url;
    if (filePath == './') {
        filePath = './login.html';
    }
    fs.exists(filePath, function (exists) {
        if (exists) {
 
            fs.readFile(filePath, function (error, content) {
                if (error) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end();
                }
                else {
                    res.writeHead(200, { 'Content-Type': mimeType[path.extname(filePath)] });
                    res.end(content, 'utf-8');
                }
            });
        }
        else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 - Not Found - '+filePath);
        }
    });
}