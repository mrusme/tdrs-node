const TDRS = require('../lib/index.js').TDRS;
const tdrs = new TDRS({
    'links': [
        {
            'receiverAddress': 'tcp://localhost:19790',
            'publisherAddress': 'tcp://localhost:19791'
        }
    ],
    'compression': false,
    'encryption': false
});

tdrs.on('message', message => {
    console.log(message.toString());
});

tdrs.connect();

setInterval(() => {
    tdrs.send(JSON.stringify({ 'id': (Math.floor(Math.random() * 1024)), 'text': 'Hello World' }));
}, 1000);
