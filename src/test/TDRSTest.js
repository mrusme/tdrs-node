//@flow
'use strict';

import test from 'ava';
import {TDRS} from '../index.js';

const DEFAULT_LINK_ONE = {
    'id': 'one',
    'receiverAddress': 'tcp://localhost:19790',
    'publisherAddress': 'tcp://localhost:19791'
};

const DEFAULT_LINK_TWO = {
    'id': 'two',
    'receiverAddress': 'tcp://localhost:19890',
    'publisherAddress': 'tcp://localhost:19891'
};

const DEFAULT_LINK_THREE = {
    'id': 'three',
    'receiverAddress': 'tcp://localhost:19990',
    'publisherAddress': 'tcp://localhost:19991'
};

const initializeDefaultTdrs = () => {
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
        'logger': null
    });
};

test('Initialization of TDRS is possible.', t => {
    const tdrs = initializeDefaultTdrs();

    if(typeof tdrs === 'undefined'
    || tdrs === null
    || typeof tdrs.connect === 'undefined') {
        return t.fail();
    }
    return t.pass();
});

test('Link is found in configuration.', t => {
    const tdrs = initializeDefaultTdrs();

    return t.true(tdrs._isLinkInConfiguration(DEFAULT_LINK_TWO));
});

test('Links have correct indexes in configuration.', t => {
    const linkOneIndex = 0;
    const linkTwoIndex = 1;
    const linkThreeIndex = 2;
    const numberOfLinks = 3;
    t.plan(numberOfLinks);

    const tdrs = initializeDefaultTdrs();

    t.is(tdrs._indexLinkInConfiguration(DEFAULT_LINK_ONE), linkOneIndex);
    t.is(tdrs._indexLinkInConfiguration(DEFAULT_LINK_TWO), linkTwoIndex);
    return t.is(tdrs._indexLinkInConfiguration(DEFAULT_LINK_THREE), linkThreeIndex);
});


