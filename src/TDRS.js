//@flow
'use strict';
import Promise from 'bluebird';
import EventEmitter from 'events';
import zmq from 'zmq';
import uuid from 'node-uuid';
import Cache from 'node-cache';
import crypto from 'crypto';
import zlib from 'zlib';

type TdrsLink = {
    publisherAddress: string,
    receiverAddress: string
};

type TdrsConfiguration = {
    links: Array<TdrsLink>,
    connectRetryBeforeFailover: ?number,
    compression: ?string,
    encryption: ?string,
    encryptionKey: ?string,
    logger: ?Object
};

type TdrsConnection = {
    active: boolean,
    link: TdrsLink,
    publisher: {
        socket: ?Object,
        connected: boolean,
        retryCount: number
    },
    receiver: {
        socket: ?Object,
        connected: boolean,
        retryCount: number
    }
};

type TdrsPacket = {
    data: any,
    status: string
};

const ARGS_INDEX_START = 0;
const ARGS_INDEX_MESSAGE = 0;

const RECEIVER_RESPONSE_STATUS_START = 0;
const RECEIVER_RESPONSE_STATUS_END = 3;
const RECEIVER_RESPONSE_HASH_START = 4;

const MAX_CONNECTION_RETRIES = 1024;

/**
 * TDRS Class
 */
export default class TDRS extends EventEmitter {
    _configuration:         TdrsConfiguration
    _connections:           Array<TdrsConnection>
    _identity:              String
    _cache:                 Function

    /**
     * Constructs the class.
     *
     * @param      {Object}   configuration       The TDRS configuration
     */
    constructor(configuration: TdrsConfiguration) {
        super();
        this._configuration = configuration;
        this._connections = [];
        this._identity = uuid.v4();
        this._cache = new Cache({
            'stdTTL': 0,
            'checkperiod': 0,
            'errorOnMissing': false
        });
    }

    /**
     * Returns the logger instance or an empty mock.
     *
     * @return     {Object}   The logger instance.
     */
    get log(): Object {
        if(typeof this._configuration.logger !== 'undefined'
        && this._configuration.logger !== null) {
            return this._configuration.logger;
        }

        return {
            'fatal': () => {},
            'error': () => {},
            'warn': () => {},
            'info': () => {},
            'debug': () => {},
            'trace': () => {}
        };
    }

    /**
     * Initializes ZeroMQ socket and connects to the specified address.
     *
     * @param      {String}   type                The type (e.g. 'pub', 'req', ...)
     * @param      {String}   address             The address
     * @param      {Function} callback            The callback function
     * @return     {Object}   The ZeroMQ socket.
     */
    _zmqSocketConnection(type: string, address: string, callback: Function) {
        const SOCKET_EVENTS_ARRAY = [
            'message',
            'connect',
            'connect_delay',
            'connect_retry',
            'close',
            'close_error',
            'disconnect',
            'monitor_error'
        ];
        const socket = zmq.socket(type);

        if(typeof socket === 'undefined'
        || socket === null) {
            throw new Error('Could not initialize publisher socket.');
        }

        switch(type) {
        case 'sub':
            socket.subscribe('');
            break;
        default:
            break;
        }

        socket.identity = this._identity;

        SOCKET_EVENTS_ARRAY.forEach(event => {
            socket.on(event, (arg1, arg2, arg3) => callback.bind(this)(event, arg1, arg2, arg3));
        });

        this._zmqSocketConnect(socket, address);

        return socket;
    }

    /**
     * Establishes the actual socket connection.
     *
     * @param      {Object}   socket              The ZeroMQ socket
     * @param      {String}   address             The address
     * @return     {Object}   The ZeroMQ socket.
     */
    _zmqSocketConnect(socket: Object, address: string) {
        const MONITOR_INTERVAL = 500;
        const MONITOR_EVENTSNR = 0;

        socket.connect(address);
        socket.monitor(MONITOR_INTERVAL, MONITOR_EVENTSNR);

        return socket;
    }

    /**
     * Handles the ZeroMQ socket message callback.
     *
     * @param      {String}   connectionType      The connection type ("publisher", "receiver")
     * @param      {Object}   connection          The TDRS connection
     * @param      {String}   connectionEvent     The connection event ("message", "connect", ...)
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True on success, False on failure.
     */
    _zmqCallback(connectionType: string, connection: TdrsConnection, connectionEvent: string, args: Array<Object>) {
        const firstCharacterIndex = 0;
        const secondCharacterIndex = 1;
        const callbackEventMethodPortion =
            connectionEvent[firstCharacterIndex]
                .toUpperCase()
            + connectionEvent
                .replace(/(_\w)/g, matches => matches[secondCharacterIndex].toUpperCase())
                .substr(secondCharacterIndex);

        const callbackName = '_' + connectionType.toLowerCase() + callbackEventMethodPortion + 'Callback';

        // @flowIgnore "access of computed property/element. Indexable signature not found"
        const callback = this[callbackName];
        this.log.debug(callbackName);
        if(typeof callback === 'function') {
            return callback.bind(this)(connection, args);
        }

        return true;
    }

    /**
     * Handles publisher "connect" callback.
     *
     * @param      {Object}   connection          The TDRS connection
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True.
     */
    _publisherConnectCallback(connection: TdrsConnection, args: Array<Object>) {
        this.log.debug('%j', connection.link);
        connection.publisher.connected = true;
        connection.publisher.retryCount = 0;
    }

    /**
     * Handles publisher "connect_delay" callback.
     *
     * @param      {Object}   connection          The TDRS connection
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True.
     */
    _publisherConnectDelayCallback(connection: TdrsConnection, args: Array<Object>) {
        this.log.debug('%j', connection.link);
        connection.publisher.connected = false;
    }

    /**
     * Handles publisher "connect_retry" callback.
     *
     * @param      {Object}   connection          The TDRS connection
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True.
     */
    _publisherConnectRetryCallback(connection: TdrsConnection, args: Array<Object>) {
        this.log.debug('%j', connection.link);
        connection.publisher.retryCount++;
        const maxRetries = this._configuration.connectRetryBeforeFailover || MAX_CONNECTION_RETRIES;
        if(connection.publisher.retryCount > maxRetries) {
            connection.publisher.retryCount = 0;
            this.reconnect();
        }
    }

    /**
     * Handles publisher "close" callback.
     *
     * @param      {Object}   connection          The TDRS connection
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True.
     */
    _publisherCloseCallback(connection: TdrsConnection, args: Array<Object>) {
        this.log.debug('%j', connection.link);
        connection.publisher.connected = false;
    }

    /**
     * Handles publisher "close_error" callback.
     *
     * @param      {Object}   connection          The TDRS connection
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True.
     */
    _publisherCloseErrorCallback(connection: TdrsConnection, args: Array<Object>) {
        this.log.debug('%j', connection.link);
        connection.publisher.connected = false;
    }

    /**
     * Handles publisher "disconnect" callback.
     *
     * @param      {Object}   connection          The TDRS connection
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True.
     */
    _publisherDisconnectCallback(connection: TdrsConnection, args: Array<Object>) {
        this.log.debug('%j', connection.link);
        connection.publisher.connected = false;
    }

    /**
     * Handles publisher "monitor_error" callback.
     *
     * @param      {Object}   connection          The TDRS connection
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True.
     */
    _publisherMonitorErrorCallback(connection: TdrsConnection, args: Array<Object>) {
        this.log.debug('%j', connection.link);
    }

    /**
     * Handles publisher "message" callback.
     *
     * @param      {Object}   connection          The TDRS connection
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True.
     */
    _publisherMessageCallback(connection: TdrsConnection, args: Array<Object>) {
        this.log.debug('%j', connection.link);
        if(!this._hasValidMessageCallbackArgs(args)) {
            throw new Error('_publisherMessageCallback got no message.');
        }

        const data = args[ARGS_INDEX_MESSAGE];

        if(data.toString().toUpperCase() === 'TERMINATE') {
            return this.emit('terminate');
        }

        const dataHash = this._hash(data);

        let packet: TdrsPacket = this.cache(dataHash);
        if(typeof packet !== 'undefined') {
            if(packet.status !== 'sent') {
                throw new Error('_publisherMessageCallback received message that was sent previously with an unexpected state!');
            }

            // This is a message that we sent, so uncache it and do not trigger
            // message processing.
            this.uncache(dataHash);
            return true;
        }

        this._decrypt(data).then(processedData => {
            return this._decompress(processedData);
        }).then(processedData => {
            this.emit('message', processedData);
        }).catch(err => {
            throw new Error(err);
        });

        return true;
    }

    /**
     * Handles receiver "message" callback.
     *
     * @param      {Object}   connection          The TDRS connection
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True.
     */
    _receiverMessageCallback(connection: TdrsConnection, args: Array<Object>) {
        this.log.debug('%j', connection.link);
        if(!this._hasValidMessageCallbackArgs(args)) {
            throw new Error('_receiverMessageCallback got no message.');
        }

        const message = args[ARGS_INDEX_MESSAGE].toString().toUpperCase();
        const status = message.substr(RECEIVER_RESPONSE_STATUS_START, RECEIVER_RESPONSE_STATUS_END);

        if(status !== 'OOK' && status !== 'NOK') {
            throw new Error('_receiverMessageCallback got weird reply.');
        }

        if(status !== 'OOK') {
            const dataHash = this._getReceiverMessageHash(message);
            let packet: TdrsPacket = this.cache(dataHash);

            if(typeof packet === 'undefined') {
                throw new Error('_receiverMessageCallback received OOK for message but could not find any cached packet with that identifier?!');
            }

            packet.status = 'undelivered';
            this.cache(dataHash, packet);
        }

        // TODO: Handle delivery retry

        return true;
    }

    /**
     * Handles receiver "connect" callback.
     *
     * @param      {Object}   connection          The TDRS connection
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True.
     */
    _receiverConnectCallback(connection: TdrsConnection, args: Array<Object>) {
        this.log.debug('%j', connection.link);
        connection.receiver.connected = true;
        connection.receiver.retryCount = 0;
    }

    /**
     * Handles receiver "connect_delay" callback.
     *
     * @param      {Object}   connection          The TDRS connection
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True.
     */
    _receiverConnectDelayCallback(connection: TdrsConnection, args: Array<Object>) {
        this.log.debug('%j', connection.link);
        connection.receiver.connected = false;
    }

    /**
     * Handles receiver "connect_retry" callback.
     *
     * @param      {Object}   connection          The TDRS connection
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True.
     */
    _receiverConnectRetryCallback(connection: TdrsConnection, args: Array<Object>) {
        this.log.debug('%j', connection.link);
        connection.receiver.retryCount++;
        const maxRetries = this._configuration.connectRetryBeforeFailover || MAX_CONNECTION_RETRIES;
        if(connection.receiver.retryCount > maxRetries) {
            connection.receiver.retryCount = 0;
            this.reconnect();
        }
    }

    /**
     * Handles receiver "close" callback.
     *
     * @param      {Object}   connection          The TDRS connection
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True.
     */
    _receiverCloseCallback(connection: TdrsConnection, args: Array<Object>) {
        this.log.debug('%j', connection.link);
        connection.receiver.connected = false;
    }

    /**
     * Handles receiver "close_error" callback.
     *
     * @param      {Object}   connection          The TDRS connection
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True.
     */
    _receiverCloseErrorCallback(connection: TdrsConnection, args: Array<Object>) {
        this.log.debug('%j', connection.link);
        connection.receiver.connected = false;
    }

    /**
     * Handles receiver "disconnect" callback.
     *
     * @param      {Object}   connection          The TDRS connection
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True.
     */
    _receiverDisconnectCallback(connection: TdrsConnection, args: Array<Object>) {
        this.log.debug('%j', connection.link);
        connection.receiver.connected = false;
    }

    /**
     * Handles receiver "monitor_error" callback.
     *
     * @param      {Object}   connection          The TDRS connection
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True.
     */
    _receiverMonitorErrorCallback(connection: TdrsConnection, args: Array<Object>) {
        this.log.debug('%j', connection.link);
    }

    /**
     * Gets the hash from a receiver message.
     *
     * @param      {String}   message             The message string
     * @return     {String}   The message hash.
     */
    _getReceiverMessageHash(message: string) {
        return message.substr(RECEIVER_RESPONSE_HASH_START);
    }

    /**
     * Determines if message callback arguments are valid.
     *
     * @param      {Array}    args                The arguments array
     * @return     {boolean}  True if arguments are valid, False otherwise.
     */
    _hasValidMessageCallbackArgs(args: Array<Object>) {
        const ARGS_INDEX_END = 1;

        if(args.length < ARGS_INDEX_END) {
            return false;
        }

        if(typeof args[ARGS_INDEX_MESSAGE] === 'undefined'
        || args[ARGS_INDEX_MESSAGE] === null) {
            return false;
        }

        return true;
    }

    /**
     * Subscribes to TdrsLink.publisherAddress
     *
     * @param      {Object}   connection          The TDRS connection
     * @return     {Object}   TdrsConnection
     */
    _subscribe(connection: TdrsConnection) {
        if(typeof connection.publisher.socket !== 'undefined'
        && connection.publisher.socket !== null
        && typeof connection.publisher.socket.close !== 'undefined') {
            this._zmqSocketConnect(connection.publisher.socket, connection.link.publisherAddress);
            return connection;
        }

        connection.publisher.socket = this._zmqSocketConnection('sub', connection.link.publisherAddress, (event, arg1, arg2, arg3) => {
            this._zmqCallback('publisher', connection, event, [arg1, arg2, arg3]);
        });

        return connection;
    }

    /**
     * Unsubscribes from TdrsLink.publisherAddress
     *
     * @param      {Object}   connection          The TDRS connection
     * @return     {Object}   TdrsConnection
     */
    _unsubscribe(connection: TdrsConnection) {
        if(typeof connection.publisher.socket !== 'undefined'
        && connection.publisher.socket !== null) {
            const unmonitor = connection.publisher.socket.unmonitor || ((x) => {});
            const disconnect = connection.publisher.socket.disconnect || ((x) => {});

            unmonitor.bind(connection.publisher.socket)();
            disconnect.bind(connection.publisher.socket)(connection.link.publisherAddress);

            connection.active = false;
        }

        return connection;
    }

    /**
     * Connects to TdrsLink.receiverAddress
     *
     * @param      {Object}   connection          The TDRS connection
     * @return     {Object}   TdrsConnection
     */
    _connect(connection: TdrsConnection) {
        if(typeof connection.receiver.socket !== 'undefined'
        && connection.receiver.socket !== null
        && typeof connection.receiver.socket.close !== 'undefined') {
            this._zmqSocketConnect(connection.receiver.socket, connection.link.receiverAddress);
            return connection;
        }

        connection.receiver.socket = this._zmqSocketConnection('req', connection.link.receiverAddress, (event, arg1, arg2, arg3) => {
            this._zmqCallback('receiver', connection, event, [arg1, arg2, arg3]);
        });

        return connection;
    }

    /**
     * Disconnects from TdrsLink.receiverAddress
     *
     * @param      {Object}   connection          The TDRS connection
     * @return     {Object}   TdrsConnection
     */
    _disconnect(connection: TdrsConnection) {
        if(typeof connection.receiver.socket !== 'undefined'
        && connection.receiver.socket !== null) {
            const unmonitor = connection.receiver.socket.unmonitor || ((x) => {});
            const disconnect = connection.receiver.socket.disconnect || ((x) => {});

            unmonitor.bind(connection.receiver.socket)();
            disconnect.bind(connection.receiver.socket)(connection.link.receiverAddress);

            connection.active = false;
        }

        return connection;
    }

    /**
     * Gets the active connection.
     *
     * @return     {Object}   The active TDRS connection.
     */
    _getActiveConnection() {
        let activeConnection: ?TdrsConnection = null;

        this._connections.forEach(connection => {
            if(connection.active === true) {
                activeConnection = connection;
                return false;
            }

            return true;
        });

        return activeConnection;
    }

    /**
     * Maps TdrsLinks to TdrsConnection-array.
     *
     * @return     {boolean}  True
     */
    _mapLinksToConnections() {
        this._configuration.links.forEach((link: TdrsLink) => {
            let found: boolean = false;

            this._connections.forEach((connection: TdrsConnection) => {
                if(connection.link.receiverAddress === link.receiverAddress
                && connection.link.publisherAddress === link.publisherAddress) {
                    found = true;
                    return false;
                }

                return true;
            });

            if(found === false) {
                const connection: TdrsConnection = {
                    'active': false,
                    'link': link,
                    'publisher': {
                        'socket': null,
                        'connected': false,
                        'retryCount': 0
                    },
                    'receiver': {
                        'socket': null,
                        'connected': false,
                        'retryCount': 0
                    }
                };

                this._connections.push(connection);
            }
        });

        return true;
    }

    /**
     * Hashes data using SHA1.
     *
     * @param      {*}        data                The data
     * @return     {String}   The SHA1 hex string.
     */
    _hash(data: any) {
        return crypto.createHash('sha1').update(data).digest('hex').toUpperCase();
    }

    /**
     * Compresses & decompresses data.
     *
     * @param      {String}   action              The action, either "compress" or "decompress"
     * @param      {Buffer}   data                The data
     * @return     {Promise}  Promise that fulfills or rejects.
     */
    _compression(action: string, data: Buffer) {
        return new Promise((fulfill, reject) => {
            if(typeof this._configuration.compression === 'undefined'
            || this._configuration.compression === null) {
                return fulfill(data);
            }

            const compression = this._configuration.compression;

            let handler = null;

            switch(compression.toLowerCase()) {
            case 'gzip':
                if(action === 'compress') {
                    handler = zlib.gzip;
                } else {
                    handler = zlib.gunzip;
                }
                break;
            case 'deflate':
                if(action === 'compress') {
                    handler = zlib.deflateRaw;
                } else {
                    handler = zlib.inflateRaw;
                }
                break;
            default:
                throw new Error('Unknown compression "' + compression + '".');
            }

            return handler(data, (err, processedData) => {
                if(err !== 'undefined' && err !== null) {
                    throw new Error(err);
                }

                return fulfill(processedData);
            });
        });
    }

    /**
     * Wraps compressor, compresses data.
     *
     * @param      {Buffer}   data                The data
     * @return     {Promise}  Promise that fulfills or rejects.
     */
    _compress(data: Buffer) {
        return this._compression('compress', data);
    }

    /**
     * Wraps compressor, decompresses data.
     *
     * @param      {Buffer}   data                The data
     * @return     {Promise}  Promise that fulfills or rejects.
     */
    _decompress(data: Buffer) {
        return this._compression('decompress', data);
    }

    /**
     * Encrypts & decrypts data.
     *
     * @param      {String}   action              The action, either "encrypt" or "decrypt"
     * @param      {Buffer}   data                The data
     * @return     {Promise}  Promise that fulfills or rejects.
     */
    _encryption(action: string, data: Buffer) {
        return new Promise((fulfill, reject) => {
            if(typeof this._configuration.encryption === 'undefined'
            || this._configuration.encryption === null
            || typeof this._configuration.encryptionKey === 'undefined'
            || this._configuration.encryptionKey === null) {
                return fulfill(data);
            }

            const encryption = this._configuration.encryption;
            const encryptionKey = this._configuration.encryptionKey;

            let processedData = null;

            switch(encryption.toLowerCase()) {
            case 'aes-256-ctr':
                if(action === 'encrypt') {
                    let cipher = crypto.createCipher(encryption.toLowerCase(), encryptionKey);
                    processedData = Buffer.concat([cipher.update(data), cipher.final()]);
                } else {
                    let decipher = crypto.createDecipher(encryption.toLowerCase(), encryptionKey);
                    processedData = Buffer.concat([decipher.update(data), decipher.final()]);
                }
                break;
            default:
                throw new Error('Unknown encryption "' + encryption + '".');
            }

            return fulfill(processedData);
        });
    }

    /**
     * Wraps encryption, encrypts data.
     *
     * @param      {Buffer}   data                The data
     * @return     {Promise}  Promise that fulfills or rejects.
     */
    _encrypt(data: Buffer) {
        return this._encryption('encrypt', data);
    }

    /**
     * Wraps encryption, decrypts data.
     *
     * @param      {Buffer}   data                The data
     * @return     {Promise}  Promise that fulfills or rejects.
     */
    _decrypt(data: Buffer) {
        return this._encryption('decrypt', data);
    }

    /**
     * Generates a random integer between min and max (inclusive).
     *
     * @param      {Integer}  min                 The minimum integer
     * @param      {Integer}  max                 The maximum integer
     * @return     {Integer}  The random integer
     */
    _randomInteger(min: number, max: number) {
        const one = 1;
        return Math.floor(Math.random() * (max - min + one)) + min;
    }

    /**
     * Caches or returns a cached packet.
     *
     * @param      {String}   identifier          The identifier string
     * @param      {*}        packet              The TDRS packet (optional)
     * @return     {*}        The cached TDRS packet.
     */
    cache(identifier: string, packet?: TdrsPacket) {
        if(typeof packet !== 'undefined'
        && packet !== null) {
            if(!this._cache.set(identifier, packet)) {
                throw new Error('Could not add/update packet to/in cache?!');
            }
        }

        return this._cache.get(identifier);
    }

    /**
     * Removes a packet from the cache.
     *
     * @param      {String}   identifier          The identifier string
     * @return     {Integer}  The number of entries removed from the cache.
     */
    uncache(identifier: string) {
        return this._cache.del(identifier);
    }

    /**
     * Connects to the TDRS service.
     *
     * @return     {boolean}  True
     */
    connect() {
        this.log.debug('connect');
        const zero = 0;
        const one = 1;

        if(this._getActiveConnection() !== null) {
            throw new Error('connect: Active connections already available. Please disconnect first.');
        }

        if(this._configuration.links.length < one) {
            throw new Error('connect: No links specified.');
        }

        this._mapLinksToConnections();

        const connectionIndex: number = this._randomInteger(zero, (this._connections.length - one));
        let connection: TdrsConnection = this._connections[connectionIndex];

        this.log.debug('Connecting to %s ...', connection.link.publisherAddress);
        this._subscribe(connection);
        this._connect(connection);
        connection.active = true;

        return true;
    }

    /**
     * Disconnects from the TDRS service.
     *
     * @return     {boolean}  True
     */
    disconnect() {
        this.log.debug('disconnect');
        let connection: ?TdrsConnection = this._getActiveConnection();

        if(typeof connection === 'undefined'
        || connection === null) {
            this.log.debug('Disconnect: No active connection!');
            return true;
        }

        this._unsubscribe(connection);
        this._disconnect(connection);

        return true;
    }

    /**
     * Disconnects from the TDRS service and reconnects to it. If multiple links were provided, it might pick another
     * one on reconnect.
     *
     * @return     {boolean}  True
     */
    reconnect() {
        this.log.debug('reconnect');
        this.disconnect();
        this.connect();

        return true;
    }

    /**
     * Sends data to the TDRS service.
     *
     * @param      {*}        data:any            The data any
     * @return     {Promise}  Promise that fulfills or rejects.
     */
    send(data: any) {
        return new Promise((fulfill, reject) => {
            const connection: ?TdrsConnection = this._getActiveConnection();

            if(typeof connection === 'undefined'
            || connection === null
            || typeof connection.receiver === 'undefined'
            || connection.receiver === null
            || typeof connection.receiver.socket === 'undefined'
            || connection.receiver.socket === null) {
                throw new Error('No active connections available. Please connect first.');
            }

            const receiverSocket = connection.receiver.socket;

            return this._compress(new Buffer(data)).then(processedData => {
                return this._encrypt(processedData);
            }).then(processedData => {
                const dataHash = this._hash(processedData);

                let packet: TdrsPacket = {
                    'data': processedData,
                    'status': 'sending'
                };

                this.cache(dataHash, packet);

                const socketFlags = 0;
                return receiverSocket.send(processedData, socketFlags, (socket, error) => {
                    if(typeof error !== 'undefined'
                    && error !== null) {
                        this.uncache(dataHash);
                        throw new Error('Could not send data.');
                    }

                    packet.status = 'sent';
                    this.cache(dataHash, packet);
                    fulfill(dataHash);
                });
            });
        });
    }
}
