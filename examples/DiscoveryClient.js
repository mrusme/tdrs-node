// const bunyan = require('bunyan');
// const logger = bunyan.createLogger({
//     'name': 'DiscoveryClient',
//     'level': 10,
// });

const TDRS = require('../lib/index.js').TDRS;
const tdrs = new TDRS({
    'discovery': {},
    'connectRetryBeforeFailover': 1,
    'compression': 'gzip',
    'encryption': 'aes-256-ctr',
    'encryptionKey': 'LaLaLaLaLaLaLaLaLa'
    // 'logger': logger
});

tdrs.on('message', message => {
    console.log(message.toString());
});

// tdrs.on('terminate', () => {
//     tdrs.disconnect();
//     process.exit(0);
// });


// setInterval(() => {
//     console.log('Sending message ...');
    tdrs.send(JSON.stringify({ 'id': (Math.floor(Math.random() * 1024)), 'text': 'Hello World' })).then(fulfillment => {
        console.log(fulfillment);
    }).catch(failure => {
        console.log(failure);
    });
// }, 1000);
