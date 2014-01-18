var cp = require('child_process');

cp.fork('./processModule.js', {silent:false});
cp.fork('./requestModule.js',{silent:false});
cp.fork('./syncModule.js',{silent:false});