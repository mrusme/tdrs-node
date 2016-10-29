const bunyan = require('/usr/local/lib/node_modules/bunyan');
const logger = bunyan.createLogger({
    'name': 'SimpleClient',
    'level': 10,
});

const TDRS = require('../lib/index.js').TDRS;
const tdrs = new TDRS({
    'links': [
        {
            'id': 'one',
            'receiverAddress': 'tcp://localhost:19790',
            'publisherAddress': 'tcp://localhost:19791'
        },
        {
            'id': 'two',
            'receiverAddress': 'tcp://localhost:19890',
            'publisherAddress': 'tcp://localhost:19891'
        },
        {
            'id': 'three',
            'receiverAddress': 'tcp://localhost:19990',
            'publisherAddress': 'tcp://localhost:19991'
        }
    ],
    'connectRetryBeforeFailover': 1,
    'compression': 'gzip',
    'encryption': 'aes-256-ctr',
    'encryptionKey': 'LaLaLaLaLaLaLaLaLa',
    'logger': logger
});

tdrs.on('message', message => {
    console.log(message.toString());
});

// tdrs.on('terminate', () => {
//     tdrs.disconnect();
//     process.exit(0);
// });

tdrs.connect();

setInterval(() => {
    console.log('Sending message ...');
    tdrs.send(JSON.stringify({ 'id': (Math.floor(Math.random() * 1024)), 'text': 'Hello World' }));
}, 1000);
