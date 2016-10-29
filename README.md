# tdrs-node
[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url]

[TDRS](https://github.com/weltraumco/tdrs) Node.js client reference implementation.

*Notice: This is __only__ a client implementation. You'll need to run a [TDRS](https://github.com/weltraumco/tdrs) link in order to test/use this Node package.*

## Usage

### NPM

In your project directory run:

```bash
$ npm install --save tdrs
```

### Source

```bash
$ git clone https://github.com/weltraumco/tdrs-node.git
$ cd tdrs-node
$ npm test
```

### Example code

If you clone this repository and build it yourself, you can try out the [TDRS](https://github.com/weltraumco/tdrs) Node.js client implementation:

##### [SimpleClient](examples/SimpleClient.js)

```
$ npm run SimpleClient
```

By default, the SimpleClient will try to establish a connection to any of these [TDRS](https://github.com/weltraumco/tdrs) links:

```
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
```

Feel free to modify [`examples/SimpleClient.js`](examples/SimpleClient.js) for testing purpose.



[npm-image]: https://badge.fury.io/js/tdrs.svg
[npm-url]: https://npmjs.org/package/tdrs
[travis-image]: https://travis-ci.org/weltraumco/tdrs-node.svg?branch=develop
[travis-url]: https://travis-ci.org/weltraumco/tdrs-node
[daviddm-image]: https://david-dm.org/weltraumco/tdrs-node.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/weltraumco/tdrs-node
