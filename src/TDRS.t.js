export type TdrsLink = {
    id: ?string,
    publisherAddress: string,
    receiverAddress: string
};

export type TdrsConfiguration = {
    links: ?Array<TdrsLink>,
    discovery: ?boolean,
    connectRetryBeforeFailover: ?number,
    sendTimeout: ?number,
    compression: ?string,
    encryption: ?string,
    encryptionKey: ?string,
    logger: ?Object
};

export type TdrsConnection = {
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

export type TdrsPacket = {
    data: any,
    status: string
};

export type TdrsPeerMessage = {
    event: string,
    id: string,
    publisherAddress: string,
    receiverAddress: string
};
