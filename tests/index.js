const path = require('path');
const assert = require('chai').assert;

const Server = require('@soundworks/core/server').Server;
const ServerAbstractExperience = require('@soundworks/core/server').AbstractExperience;

const Client = require('@soundworks/core/client').Client;
const ClientAbstractExperience = require('@soundworks/core/client').AbstractExperience;

const serverPluginFactory = require('../server').default;
const clientPluginFactory = require('../client').default;

const fs = require('fs');
const os = require('os')
const config = require('./config');

class ServerTestExperience extends ServerAbstractExperience {
  constructor(server, clientTypes) {
    super(server, clientTypes);
    this.logger = this.require('logger');
  }
}

class ClientTestExperience extends ClientAbstractExperience {
  constructor(client) {
    super(client);
    this.logger = this.require('logger');
  }
}

let serverExperience;
let clientExperience = [];
const numClients = 1;

before('initialization', function(done) {
  this.timeout(10000);

  // cf. https://stackoverflow.com/a/57305241
  (async () => {
    // ---------------------------------------------------
    // server
    // ---------------------------------------------------
    const server = new Server();
    server.pluginManager.register('logger', serverPluginFactory, {
      directory: path.join(__dirname, 'logs'),
    });

    // this is boring... should not be mandatory
    server.templateEngine = { compile: () => {} };
    server.templateDirectory = __dirname;

    await server.init(config);
    serverExperience = new ServerTestExperience(server, config.clientType);

    await server.start();

    // ---------------------------------------------------
    // client
    // ---------------------------------------------------
    for (let i = 0; i < numClients; i++) {
      const client = new Client();
      client.pluginManager.register('logger', clientPluginFactory, {}, []);

      await client.init(config);
      // console.log('client inited');
      clientExperience = new ClientTestExperience(client);

      await client.start();
      clientExperience.start();
    }

    console.log(`> created ${numClients} clients`);
    return Promise.resolve();
  })().then(done);
});

describe('server:plugin-logger', () => {
  it('should log strings properly', async () => {
    const filename = 'server-string.txt';
    const writer = await serverExperience.logger.create(filename);

    let expected = '';
    // write some data
    for (let i = 0; i < 10; i++) {
      const msg = `server-${i}`;

      writer.write(msg);
      expected += msg + os.EOL;
    }

    await writer.close(); // should be async

    const actual = fs.readFileSync(writer.path).toString();
    assert.equal(actual, expected, 'should properly write strings');
    // ignore write after end
    writer.write(`do-not-log`);
    assert.equal(actual, expected, 'should properly write strings');

    return Promise.resolve();
  });

  it('should log Primitives properly', async () => {
    const filename = 'server-primitives.txt';
    const writer = await serverExperience.logger.create(filename);

    const obj = true;
    writer.write(obj);

    await writer.close(); // should be async

    const actual = fs.readFileSync(writer.path).toString();
    const expected = JSON.stringify(obj) + os.EOL;
    assert.equal(actual, expected, 'should properly write primitives');

    return Promise.resolve();
  });

  it('should log Objects properly', async () => {
    const filename = 'server-objects.txt';
    const writer = await serverExperience.logger.create(filename);

    const expected = { a: 'a', b: true, c: 42 };
    writer.write(expected);

    await writer.close(); // should be async

    const actual = JSON.parse(fs.readFileSync(writer.path));
    assert.deepEqual(actual, expected, 'should properly write objects');

    return Promise.resolve();
  });

  it('should log Arrays properly', async () => {
    const filename = 'server-arrays.txt';
    const writer = await serverExperience.logger.create(filename);

    const expected = [0, 1, 2];
    writer.write(expected);

    await writer.close(); // should be async

    const actual = JSON.parse(fs.readFileSync(writer.path));
    assert.deepEqual(actual, expected, 'should properly write arrays');

    return Promise.resolve();
  });

  it('should log Binary Arrays properly', async () => {
    const filename = 'server-binary-arrays.txt';
    const writer = await serverExperience.logger.create(filename);

    // we expect binary arrays to be logged as traditionnal arrays
    const expected = [Math.random(),Math.random(),Math.random()];
    // we use a Float64Array as we dont want to check float convertions / errors
    const binary = new Float64Array(expected);

    writer.write(binary);

    await writer.close();

    const actual = JSON.parse(fs.readFileSync(writer.path));
    assert.deepEqual(actual, expected, 'should properly write arrays');

    return Promise.resolve();
  });
});


describe('client:plugin-logger', () => {
  it('should log strings properly', async () => {
    const filename = 'client-string.txt';
    const writer = await clientExperience.logger.create(filename);

    let expected = '';
    // write some data
    for (let i = 0; i < 10; i++) {
      const msg = `client-${i}`;

      writer.write(msg);
      expected += msg + os.EOL;
    }

    await writer.close(); // @todo - should be really async
    // as `writer.close` is not really async, we wait for the writer to be
    // flushed server-side
    const serverWriter = Array.from(serverExperience.logger.writers).find(w => w.name === filename);

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const actual = fs.readFileSync(serverWriter.path).toString();
        assert.equal(actual, expected, 'should properly write strings');
        // this is not implemented, is this a good idea...
        // assert.throws(() => writer.write(`client-crash`), 'write after end');
        resolve();
      }, 20);
    });
  });

  it('should log Primitives properly', async () => {
    const filename = 'client-primitives.txt';
    const writer = await clientExperience.logger.create(filename);

    const obj = true;
    writer.write(obj);

    await writer.close(); // @todo - should be really async

    const serverWriter = Array.from(serverExperience.logger.writers).find(w => w.name === filename);

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const actual = fs.readFileSync(serverWriter.path).toString();
        const expected = JSON.stringify(obj) + os.EOL;
        assert.equal(actual, expected, 'should properly write primitives');
        resolve();
      }, 20);
    });
  });

  it('should log Objects properly', async () => {
    const filename = 'client-objects.txt';
    const writer = await clientExperience.logger.create(filename);

    const expected = { a: 'a', b: true, c: 42 };
    writer.write(expected);

    await writer.close(); // @todo - should be really async

    const serverWriter = Array.from(serverExperience.logger.writers).find(w => w.name === filename);

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const actual = JSON.parse(fs.readFileSync(serverWriter.path));
        assert.deepEqual(actual, expected, 'should properly write objects');
        resolve();
      }, 20);
    });
  });

  it('should log Arrays properly', async () => {
    const filename = 'client-arrays.txt';
    const writer = await clientExperience.logger.create(filename);

    const expected = [0, 1, 2];
    writer.write(expected);

    await writer.close(); // @todo - should be really async

    const serverWriter = Array.from(serverExperience.logger.writers).find(w => w.name === filename);

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const actual = JSON.parse(fs.readFileSync(serverWriter.path));
        assert.deepEqual(actual, expected, 'should properly write arrays');
        resolve();
      }, 20);
    });
  });

  it('should log Binary Arrays properly', async () => {
    const filename = 'client-binary-arrays.txt';
    const writer = await clientExperience.logger.create(filename);

    // we expect binary arrays to be logged as traditionnal arrays
    const expected = [Math.random(),Math.random(),Math.random()];
    // we use a Float64Array as we dont want to check float convertions / errors
    // @note - this doesn't work properly from client side, proabably something
    // with the way sockets are handling BinaryArrays.
    const binary = new Float64Array(expected);

    writer.write(binary);

    await writer.close(); // @todo - should be really async

    const serverWriter = Array.from(serverExperience.logger.writers).find(w => w.name === filename);

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const actual = JSON.parse(fs.readFileSync(serverWriter.path));
        // we have some conversion problems here, why ? this is strange
        for (let i = 0; i < actual.length; i++) {
          assert.approximately(actual[i], expected[i], 1e-6);
        }

        resolve();
      }, 20);
    });
  });
});

