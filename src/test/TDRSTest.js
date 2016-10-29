//@flow
'use strict';

import test from 'ava';
import {TDRS} from '../index.js';

import type {
    TdrsLink,
    TdrsConfiguration,
    TdrsConnection,
    TdrsPacket,
    TdrsPeerMessage
} from '../index.js';

const DEFAULT_LINK_ONE = {
    'id': 'one',
    'receiverAddress': 'tcp://localhost:19960',
    'publisherAddress': 'tcp://localhost:19961'
};

const DEFAULT_LINK_TWO = {
    'id': 'two',
    'receiverAddress': 'tcp://localhost:19970',
    'publisherAddress': 'tcp://localhost:19971'
};

const DEFAULT_LINK_THREE = {
    'id': 'three',
    'receiverAddress': 'tcp://localhost:19980',
    'publisherAddress': 'tcp://localhost:19981'
};

const DEFAULT_LINK_FOUR = {
    'id': 'four',
    'receiverAddress': 'tcp://localhost:19990',
    'publisherAddress': 'tcp://localhost:19991'
};

const PEER_MESSAGE_PREFIX = 'PEER';

const PEER_MESSAGE_EVENT_ENTER = 'ENTER';
const PEER_MESSAGE_EVENT_EXIT = 'EXIT';

const PEER_MESSAGE_DEFAULT_ID = '8E02C89DC08D48D59CB14B1E57909AED';
const PEER_MESSAGE_DEFAULT_PUB_PTCL = 'tcp';
const PEER_MESSAGE_DEFAULT_PUB_ADDR = '127.0.0.1';
const PEER_MESSAGE_DEFAULT_PUB_PORT = 12300;
const PEER_MESSAGE_DEFAULT_SUB_PTCL = PEER_MESSAGE_DEFAULT_PUB_PTCL;
const PEER_MESSAGE_DEFAULT_SUB_ADDR = PEER_MESSAGE_DEFAULT_PUB_ADDR;
const PEER_MESSAGE_DEFAULT_SUB_PORT = 12301;

const PEER_MESSAGE_ENTER = `${PEER_MESSAGE_PREFIX}:` +
                           `${PEER_MESSAGE_EVENT_ENTER}:` +
                           `${PEER_MESSAGE_DEFAULT_ID}:` +
                           `${PEER_MESSAGE_DEFAULT_PUB_PTCL}:` +
                           `${PEER_MESSAGE_DEFAULT_PUB_ADDR}:` +
                           `${PEER_MESSAGE_DEFAULT_PUB_PORT}:` +
                           `${PEER_MESSAGE_DEFAULT_SUB_PTCL}:` +
                           `${PEER_MESSAGE_DEFAULT_SUB_ADDR}:` +
                           `${PEER_MESSAGE_DEFAULT_SUB_PORT}`;

const PEER_MESSAGE_EXIT  = `${PEER_MESSAGE_PREFIX}:` +
                           `${PEER_MESSAGE_EVENT_EXIT}:` +
                           `${PEER_MESSAGE_DEFAULT_ID}:` +
                           '*:' +
                           '*:' +
                           '*:' +
                           '*:' +
                           '*:' +
                           '*';

const DEFAULT_STRING = 'Hello World';
const DEFAULT_STRING_SHA1_HASH = '0A4D55A8D778E5022FAB701977C5D840BBC486D0';

const initializeDefaultTdrs = (params: ?Object) => {
    const options = params || {};

    return new TDRS({
        'links': [
            DEFAULT_LINK_ONE,
            DEFAULT_LINK_TWO,
            DEFAULT_LINK_THREE
        ],
        'connectRetryBeforeFailover': 1,
        'compression': 'gzip',
        'encryption': 'aes-256-ctr',
        'encryptionKey': 'LaLaLaLaLaLaLaLaLa',
        'logger': options.logger || null
    });
};

test('Initialization of TDRS is possible', t => {
    const tdrs = initializeDefaultTdrs();

    if(typeof tdrs === 'undefined'
    || tdrs === null
    || typeof tdrs.connect === 'undefined') {
        return t.fail();
    }
    return t.pass();
});

test('Retrieval of NULL logger is possible', t => {
    const tdrs = initializeDefaultTdrs();

    if(typeof tdrs.log !== 'undefined' && typeof tdrs.log.debug !== 'undefined' && tdrs.log.debug()) {
        return t.pass();
    }

    return t.fail();
});

test('Retrieval of mock logger is possible', t => {
    const tdrs = initializeDefaultTdrs({
        'logger': {
            'debug': () => {
                return t.pass();
            }
        }
    });

    if(typeof tdrs.log !== 'undefined' && typeof tdrs.log.debug !== 'undefined') {
        return tdrs.log.debug();
    }

    return t.fail();
});

test('Link is found in configuration', t => {
    const tdrs = initializeDefaultTdrs();

    return t.true(tdrs._isLinkInConfiguration(DEFAULT_LINK_TWO));
});

test('Links have correct indexes in configuration', t => {
    const linkOneIndex = 0;
    const linkTwoIndex = 1;
    const linkThreeIndex = 2;
    const numberOfTests = 3;
    t.plan(numberOfTests);

    const tdrs = initializeDefaultTdrs();

    t.is(tdrs._indexLinkInConfiguration(DEFAULT_LINK_ONE), linkOneIndex);
    t.is(tdrs._indexLinkInConfiguration(DEFAULT_LINK_TWO), linkTwoIndex);
    return t.is(tdrs._indexLinkInConfiguration(DEFAULT_LINK_THREE), linkThreeIndex);
});

test('Adding links to configuration is possible', t => {
    const linkFourIndex = 3;
    const numberOfTests = 3;
    t.plan(numberOfTests);

    const tdrs = initializeDefaultTdrs();

    t.true(tdrs._addLinkToConfiguration(DEFAULT_LINK_FOUR));
    t.is(tdrs._indexLinkInConfiguration(DEFAULT_LINK_FOUR), linkFourIndex);
    return t.true(tdrs._isLinkInConfiguration(DEFAULT_LINK_FOUR));
});

test('Removing links by ID from configuration is possible', t => {
    const newConfigurationArraySize = 2;
    const numberOfTests = 2;
    t.plan(numberOfTests);

    const tdrs = initializeDefaultTdrs();

    t.true(tdrs._removeLinkFromConfigurationById('two'));
    return t.is(tdrs.configuredLinks.length, newConfigurationArraySize);
});

test('Mapping links from configuration to connections is possible', t => {
    const numberOfTests = 5;
    t.plan(numberOfTests);

    const tdrs = initializeDefaultTdrs();

    t.true(tdrs._mapConfiguredLinksToConnections());
    t.true(tdrs._isConfiguredLinkInConnections(DEFAULT_LINK_ONE));
    t.true(tdrs._isConfiguredLinkInConnections(DEFAULT_LINK_TWO));
    t.true(tdrs._isConfiguredLinkInConnections(DEFAULT_LINK_THREE));
    return t.false(tdrs._isConfiguredLinkInConnections(DEFAULT_LINK_FOUR));
});

test('Unmapping non-existent links from connections is possible', t => {
    const numberOfTests = 5;
    t.plan(numberOfTests);

    const tdrs = initializeDefaultTdrs();

    t.true(tdrs._mapConfiguredLinksToConnections());
    t.true(tdrs._removeLinkFromConfigurationById('two'));
    t.not(tdrs._findConnectionForLink(DEFAULT_LINK_TWO), null);
    t.true(tdrs._unmapNonexistentConfiguredLinksFromConnections());
    return t.is(tdrs._findConnectionForLink(DEFAULT_LINK_TWO), null);
});

test('Getting active connection from connections is possible', t => {
    const dummyConnectionIndex = 1;
    const numberOfTests = 3;
    t.plan(numberOfTests);

    const tdrs = initializeDefaultTdrs();

    t.is(tdrs._getActiveConnection(), null);
    t.true(tdrs._mapConfiguredLinksToConnections());
    tdrs.connections[dummyConnectionIndex].active = true;
    return t.not(tdrs._getActiveConnection(), null);
});

test('SHA1 hashing is possible', t => {
    const tdrs = initializeDefaultTdrs();

    return t.is(tdrs._hash(DEFAULT_STRING), DEFAULT_STRING_SHA1_HASH);
});

test('Peer message (ENTER) parsing is possible', t => {
    const numberOfTests = 5;
    t.plan(numberOfTests);

    const tdrs = initializeDefaultTdrs();
    const peerMessage: ?TdrsPeerMessage = tdrs._parsePeerMessage(PEER_MESSAGE_ENTER);

    t.not(peerMessage, null);
    // @flowIgnore NULL check happend previously
    t.is(peerMessage.event, PEER_MESSAGE_EVENT_ENTER);
    // @flowIgnore NULL check happend previously
    t.is(peerMessage.id, PEER_MESSAGE_DEFAULT_ID);
    // @flowIgnore NULL check happend previously
    t.is(peerMessage.publisherAddress, `${PEER_MESSAGE_DEFAULT_PUB_PTCL}://${PEER_MESSAGE_DEFAULT_PUB_ADDR}:${PEER_MESSAGE_DEFAULT_PUB_PORT}`);
    // @flowIgnore NULL check happend previously
    return t.is(peerMessage.receiverAddress, `${PEER_MESSAGE_DEFAULT_SUB_PTCL}://${PEER_MESSAGE_DEFAULT_SUB_ADDR}:${PEER_MESSAGE_DEFAULT_SUB_PORT}`);
});

test('Compression and decompression is possible', t => {
    const tdrs = initializeDefaultTdrs();

    return tdrs._compress(new Buffer(DEFAULT_STRING)).then(compressed => {
        return tdrs._decompress(compressed);
    }).then(decompressed => {
        return t.is(decompressed.toString(), DEFAULT_STRING);
    });
});

test('Encryption and decryption is possible', t => {
    const tdrs = initializeDefaultTdrs();

    return tdrs._encrypt(new Buffer(DEFAULT_STRING)).then(encrypted => {
        return tdrs._decrypt(encrypted);
    }).then(decrypted => {
        return t.is(decrypted.toString(), DEFAULT_STRING);
    });
});

test('Generating random integer is possible', t => {
    const min = 1;
    const max = 10;
    const numberOfTests = 100;
    t.plan(numberOfTests);

    const tdrs = initializeDefaultTdrs();

    for(let i = 0; i < numberOfTests; i++) {
        const random = tdrs._randomInteger(min, max);
        t.true((random >= min && random <= max));
    }
});
