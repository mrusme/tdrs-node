//@flow
'use strict';
import Promise from 'bluebird';

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
            'warn': () => console.log.apply(console, arguments),
            'info': () => console.log.apply(console, arguments),
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
        const peerId                 = event.peer_uuid();
        const eventType              = event.type_name();
        const eventPublisherProtocol = event.header('X-PUB-PTCL') || '*';
        const eventPublisherAddress  = event.peer_addr() || '*';
        const eventPublisherPort     = event.header('X-PUB-PORT') || '*';
        const eventReceiverProtocol  = event.header('X-REC-PTCL') || '*';
        const eventReceiverAddress   = event.peer_addr() || '*';
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
     * Runs the discovery listener.
     *
     * @return     {boolean}  True.
     */
    _run() {
        this.log.debug('Starting discovery listener ...');
        this._zyre.start();
        this._zyre.join('TDRS');

        while(true) {
            const event = new this._zyreBinding.ZyreEvent(this._zyre);
            this.log.debug('Got you discovery event!');
            if(!event.defined()) {
                // TODO: Handle interruption
                this.log.debug('Event undefined.');
                break;
            }

            const eventType = event.type_name();
            this.log.debug('Event: %s', eventType);

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
