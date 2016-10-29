//@flow
'use strict';
import Promise from 'bluebird';

import type {
    TdrsZeroAddress
} from './TDRS.t';

/**
 * Discovery Class
 */
class Discovery {
    _zyreBinding:           Function
    _zyre:                  Function

    /**
     * Constructs the class.
     */
    constructor() {
        try {
            this._zyreBinding = require('bindings')('zyre');
            this._zyre = new this._zyreBinding.Zyre();
        } catch(err) {
            throw new Error(err);
        }
    }

    /**
     * Returns the logger instance or an empty mock.
     *
     * @return     {Object}   The logger instance.
     */
    get log(): Object {
        return {
            'fatal': () => console.log.apply(console, arguments),
            'error': () => console.log.apply(console, arguments),
            'warn': () =>  console.log.apply(console, arguments),
            'info': () =>  console.log.apply(console, arguments),
            'debug': () => console.log.apply(console, arguments),
            'trace': () => console.log.apply(console, arguments)
        };
    }

    /**
     * Generates PEER message.
     *
     * @param      {Object}   event               The Zyre event
     * @return     {string}   The TDRS peer message string.
     */
    _buildPeerMessage(event: Object): string {
        const peerId                 = event.peerUuid();
        const peerZeroAddress        = this._parseZeroAddress(event.peerAddr()) || {};
        const eventType              = event.type();
        const eventPublisherProtocol = event.header('X-PUB-PTCL') || '*';
        const eventPublisherAddress  = peerZeroAddress.address || '*';
        const eventPublisherPort     = event.header('X-PUB-PORT') || '*';
        const eventReceiverProtocol  = event.header('X-REC-PTCL') || '*';
        const eventReceiverAddress   = peerZeroAddress.address || '*';
        const eventReceiverPort      = event.header('X-REC-PORT') || '*';

        const peerMessage = 'PEER:' +
                            `${eventType}:` +
                            `${peerId}:` +
                            `${eventPublisherProtocol}:` +
                            `${eventPublisherAddress}:` +
                            `${eventPublisherPort}:` +
                            `${eventReceiverProtocol}:` +
                            `${eventReceiverAddress}:` +
                            `${eventReceiverPort}`;

        return peerMessage;
    }

    /**
     * Parses ZeroMQ address to TDRS ZeroAddress object.
     *
     * @param      {string}   address             The address string
     * @return     {Object}   The TDRS ZeroAddress object.
     */
    _parseZeroAddress(address: string): ?TdrsZeroAddress {
        const ZA_PROTOCOL_INDEX = 1;
        const ZA_ADDRESS_INDEX = 2;
        const ZA_PORT_INDEX = 3;
        const zeroAddressRegex = /(.+):\/\/([0-9\.\*]+):?([0-9]*)/gi;
        const match = zeroAddressRegex.exec(address);

        if(typeof match === 'undefined' || match === null) {
            return null;
        }

        const zeroAddress = {
            'protocol': match[ZA_PROTOCOL_INDEX],
            'address': match[ZA_ADDRESS_INDEX],
            'port': parseInt(match[ZA_PORT_INDEX], 10)
        };

        return zeroAddress;
    }

    /**
     * Runs the discovery listener.
     *
     * @return     {boolean}  True.
     */
    run() {
        this._zyre.start();
        this._zyre.join('TDRS');

        while(true) {
            const event = new this._zyreBinding.ZyreEvent(this._zyre);
            if(!event.defined()) {
                // TODO: Handle interruption
                break;
            }

            const eventType = event.type();

            if(eventType === 'ENTER' || eventType === 'EXIT') {
                if(eventType === 'ENTER') {
                    // TODO: Verify X-KEY
                }

                const peerMessage = this._buildPeerMessage(event);

                if(typeof peerMessage === 'string') {
                    // @flowIgnore it's not undefined.
                    process.send(peerMessage);
                }
            }
        }

        this._zyre.stop();
        this._zyre.destroy();

        return true;
    }
}

const discovery = new Discovery();
discovery.run();
