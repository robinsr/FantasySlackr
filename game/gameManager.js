var cp = require('child_process');

cp.fork('./processModule.js');
cp.fork('./requestModule.js');
cp.fork('./syncModule.js');