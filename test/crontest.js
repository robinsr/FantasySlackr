// */5 * * * *


var cronJob = require('cron').CronJob;
new cronJob('*/1 * * * *', function(){
    console.log('You will see this message every minute');
}, null, true);