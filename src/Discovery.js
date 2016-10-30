//@flow
'use strict';
import Promise from 'bluebird';

import type {
    TdrsDiscoveryConfiguration,
    TdrsZeroAddress
} from './TDRS.t';

/**
 * Discovery Class
 */
class Discovery {
    _configuration:         TdrsDiscoveryConfiguration
    _zyreBinding:           Function
    _zyre:                  Function

    /**
     * Constructs the class.
     *
     * @param      {Object}   configuration       The TDRS discovery config
     */
    constructor(configuration: TdrsDiscoveryConfiguration) {
        this._configuration = configuration;

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
        this._zyre.setPort(this._configuration.port);
        this._zyre.setInterval(this._configuration.interval);

        if(typeof this._configuration.inteface !== 'undefined'
        && this._configuration.inteface !== null) {
            this._zyre.setInterface(this._configuration.interface);
        }

        this._zyre.start();
        this._zyre.join(this._configuration.group);

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


const CFG_INTERFACE_INDEX = 2;
const CFG_PORT_INDEX = 3;
const CFG_INTERVAL_INDEX = 4;
const CFG_GROUP_INDEX = 5;
const CFG_KEY_INDEX = 6;

const DEFAULT_DISCOVERY_PORT = 5670;
const DEFAULT_DISCOVERY_INTERVAL = 1000;


const config: TdrsDiscoveryConfiguration = {
    'interface': (process.argv[CFG_INTERFACE_INDEX] !== ''
        ? process.argv[CFG_INTERFACE_INDEX]
        : null),
    'port': (process.argv[CFG_PORT_INDEX]      !== ''
        ? parseInt(process.argv[CFG_PORT_INDEX], 10)
        : DEFAULT_DISCOVERY_PORT),
    'interval': (process.argv[CFG_INTERVAL_INDEX]  !== ''
        ? parseInt(process.argv[CFG_INTERVAL_INDEX], 10)
        : DEFAULT_DISCOVERY_INTERVAL),
    'group': (process.argv[CFG_GROUP_INDEX]     !== ''
        ? process.argv[CFG_GROUP_INDEX]
        : 'TDRS'),
    'key': (process.argv[CFG_KEY_INDEX]       !== ''
        ? process.argv[CFG_KEY_INDEX]
        : 'TDRS')
};

const discovery = new Discovery(config);
discovery.run();
