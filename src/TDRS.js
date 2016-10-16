//@flow
'use strict';
import zmq from 'zmq';
import uuid from 'node-uuid';

type Link = {
    publisherAddress: String,
    receiverAddress: String
};

type TdrsConfiguration = {
    links: Array<Link>,
    compression: ?Boolean,
    encryption: ?Boolean,
    encryptionKey: ?String
};

/**
 * TDRS Class
 */
export default class TDRS {
    _configuration:         TdrsConfiguration
    /**
     * Constructs the class.
     *
     * @param      {Object}  configuration:TdrsConfiguration  The configuration TDRS configuration
     */
    constructor(configuration: TdrsConfiguration) {
        this._configuration = configuration;
    }
}
