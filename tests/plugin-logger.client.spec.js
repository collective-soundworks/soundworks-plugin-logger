import fs from 'node:fs';

import { assert } from 'chai';
import { delay } from '@ircam/sc-utils';

import { Server } from '@soundworks/core/server.js';
import { Client } from '@soundworks/core/client.js';

import pluginLoggerServer from '../src/PluginLoggerServer.js';
import pluginLoggerClient from '../src/pluginLoggerClient.js';

const config = {
  app: {
    name: 'test-plugin-logger',
    clients: {
      test: {
        target: 'node',
      },
    },
  },
  env: {
    port: 8080,
    serverAddress: '127.0.0.1',
    useHttps: false,
    verbose: false,
  },
  role: 'test',
};

describe(`PluginLoggerClient`, () => {
  before(async () => {
    if (fs.existsSync('tests/logs')) {
      await fs.promises.rm('tests/logs', { recursive: true });
    }
  });

  let server;
  let serverLogger;

  beforeEach(async () => {
    server = new Server(config);
    server.pluginManager.register('logger', pluginLoggerServer, {
      dirname: 'tests/logs'
    });

    await server.start();
    serverLogger = await server.pluginManager.get('logger');
  });

  afterEach(async () => {
    await server.stop();
  });

  describe(`# plugin registration`, () => {
    it(`should properly register`, async () => {
      const client = new Client(config);
      client.pluginManager.register('logger', pluginLoggerClient);
      await client.start();
      const logger = await client.pluginManager.get('logger');

      assert.equal(true, true);
    });
  });

  describe(`# async attachWriter(name)`, () => {
    it(`should throw if writer has not been created by the server`, async () => {
      const client = new Client(config);
      client.pluginManager.register('logger', pluginLoggerClient);
      await client.start();
      const logger = await client.pluginManager.get('logger');

      let errored = false;

      try {
        const writer = await logger.attachWriter('global-log');
      } catch (err) {
        console.log(err.message);
        errored = true;
      }

      if (!errored) {
        assert.fail('should have thrown');
      }
    });

    it(`should be able to attach to writer created by the server`, async () => {
      await serverLogger.createWriter('global-log');

      const client = new Client(config);
      client.pluginManager.register('logger', pluginLoggerClient);
      await client.start();
      const logger = await client.pluginManager.get('logger');

      const writer = await logger.attachWriter('global-log');

      assert.equal(writer.name, 'global-log');
      assert.isTrue(writer.pathname.endsWith('global-log.txt'));
    });
  });

  describe(`# [attached] WriterClient.write(data)`, () => {
    it(`should be able to write to attached writer`, async () => {
      await serverLogger.createWriter('attach-global-log');

      const client = new Client(config);
      client.pluginManager.register('logger', pluginLoggerClient);
      await client.start();
      const logger = await client.pluginManager.get('logger');

      // default buffer size -> 1
      const writer = await logger.attachWriter('attach-global-log');
      writer.write('coucou'); // string
      writer.write({ a: 42 }); // object
      writer.write([0, 1, 2, 3]); // arrays
      writer.write(true); // primitives
      writer.write(new Float32Array([0, 1, 2])); // typed array

      await delay(100);

      const content = fs.readFileSync(writer.pathname).toString();
      const expected = `coucou\n{"a":42}\n[0,1,2,3]\ntrue\n[0,1,2]\n`;

      assert.equal(content, expected);
    });

    it(`all nodes should be able to write to same shared writer`, async () => {
      let writerServer = await serverLogger.createWriter('share-global-log');
      let writer1;
      let writer2;

      {
        const client = new Client(config);
        client.pluginManager.register('logger', pluginLoggerClient);
        await client.start();
        const logger = await client.pluginManager.get('logger');
        writer1 = await logger.attachWriter('share-global-log');
      }

      {
        const client = new Client(config);
        client.pluginManager.register('logger', pluginLoggerClient);
        await client.start();
        const logger = await client.pluginManager.get('logger');
        writer2 = await logger.attachWriter('share-global-log');
      }

      // put some delay to make sure things are logged in right order
      writer1.write('coucou'); // string
      await delay(50);
      writer2.write({ a: 42 }); // object
      await delay(50);
      writerServer.write([0, 1, 2, 3]); // arrays
      await delay(50);
      writer2.write(true); // primitives
      await delay(50);
      writer1.write(new Float32Array([0, 1, 2])); // typed array
      await delay(50);

      const content = fs.readFileSync(writerServer.pathname).toString();
      const expected = `coucou\n{"a":42}\n[0,1,2,3]\ntrue\n[0,1,2]\n`;

      assert.equal(content, expected);
    });

    it(`should take given buffer size into account`, async () => {
      await serverLogger.createWriter('buffer-global-log');

      const client = new Client(config);
      client.pluginManager.register('logger', pluginLoggerClient);
      await client.start();
      const logger = await client.pluginManager.get('logger');
      // values will be written after 5th call to write
      const writer = await logger.attachWriter('buffer-global-log', { bufferSize: 5 });
      writer.write('coucou'); // string
      writer.write({ a: 42 }); // object
      writer.write([0, 1, 2, 3]); // arrays
      writer.write(true); // primitives

      // file should be empty at this point
      await delay(500);
      {
        const content = fs.readFileSync(writer.pathname).toString();
        const expected = '';
        assert.equal(content, expected);
      }

      writer.write(new Float32Array([0, 1, 2])); // typed array
      await delay(50);

      {
        const content = fs.readFileSync(writer.pathname).toString();
        const expected = `coucou\n{"a":42}\n[0,1,2,3]\ntrue\n[0,1,2]\n`;
        assert.equal(content, expected);
      }
    });
  });

  describe(`# [attached] await WriterClient.close()`, () => {
    it(`should close the writer`, async () => {
      await serverLogger.createWriter('attached-simple-close');

      const client = new Client(config);
      client.pluginManager.register('logger', pluginLoggerClient);
      await client.start();
      const logger = await client.pluginManager.get('logger');
      // values will be written after 5th call to write
      const writer = await logger.attachWriter('attached-simple-close');
      // put some delay to make sure things are logged in right order
      writer.write('a');
      await writer.close();
      await delay(100);

      writer.write('b'); // this should silentely fail
      await delay(100);

      const content = fs.readFileSync(writer.pathname).toString();
      const expected = `a\n`;
      assert.equal(content, expected);
    });

    it(`should flush the buffer`, async () => {
      await serverLogger.createWriter('attached-flush-close');

      const client = new Client(config);
      client.pluginManager.register('logger', pluginLoggerClient);
      await client.start();
      const logger = await client.pluginManager.get('logger');
      // values will be written after 5th call to write
      const writer = await logger.attachWriter('attached-flush-close', { bufferSize: 5 });
      // put some delay to make sure things are logged in right order
      writer.write('a');

      {
        const content = fs.readFileSync(writer.pathname).toString();
        const expected = ``;
        assert.equal(content, expected);
      }

      await writer.close();
      await delay(100);

      {
        const content = fs.readFileSync(writer.pathname).toString();
        const expected = `a\n`;
        assert.equal(content, expected);
      }
    });

    it(`other nodes should be able to write the stream`, async () => {
      const serverWriter = await serverLogger.createWriter('attached-multiple-close');

      {
        const client = new Client(config);
        client.pluginManager.register('logger', pluginLoggerClient);
        await client.start();
        const logger = await client.pluginManager.get('logger');
        // values will be written after 5th call to write
        const writer = await logger.attachWriter('attached-multiple-close');
        // put some delay to make sure things are logged in right order
        writer.write('a');
        await writer.close();
        await delay(100);
      }

      {
        const client = new Client(config);
        client.pluginManager.register('logger', pluginLoggerClient);
        await client.start();
        const logger = await client.pluginManager.get('logger');
        // values will be written after 5th call to write
        const writer = await logger.attachWriter('attached-multiple-close');
        // put some delay to make sure things are logged in right order
        writer.write('b');
        await writer.close();
        await delay(100);
      }

      serverWriter.write('c');
      await delay(100);

      const content = fs.readFileSync(serverWriter.pathname).toString();
      const expected = `a\nb\nc\n`;
      assert.equal(content, expected);
    });
  });

  describe(`# async createWriter(name) -> WriterClient`, () => {
    it(`should return a Writer`, async () => {
      const client = new Client(config);
      client.pluginManager.register('logger', pluginLoggerClient);
      await client.start();
      const logger = await client.pluginManager.get('logger');

      const writer = await logger.createWriter('create-log');

      // should be in writers but not in the global list
      assert.equal(serverLogger._writers.get(client.id).size, 1);
      assert.isFalse('create-log' in serverLogger._internalState.get('list'));
    });

    it(`should return a Writer - usePrefix=false`, async () => {
      const client = new Client(config);
      client.pluginManager.register('logger', pluginLoggerClient);
      await client.start();
      const logger = await client.pluginManager.get('logger');
      const writer = await logger.createWriter('create-log-no-prefix', { usePrefix: false });

      assert.equal(writer.pathname, 'tests/logs/create-log-no-prefix.txt');
    });

    it(`should propagete errors from the server`, async () => {
      fs.writeFileSync('tests/logs/file-exists.txt', '');

      const client = new Client(config);
      client.pluginManager.register('logger', pluginLoggerClient);
      await client.start();
      const logger = await client.pluginManager.get('logger');

      let errored = false;

      try {
        const writer = await logger.createWriter('file-exists.txt', { usePrefix: false });
      } catch(err) {
        console.log(err.message);
        errored = true;
      }

      if (!errored) {
        assert.fail('should have failed');
      }
    });
  });

  describe(`# [created] Writer.write(name)`, () => {
    it(`should log values`, async () => {
      const client = new Client(config);
      client.pluginManager.register('logger', pluginLoggerClient);
      await client.start();
      const logger = await client.pluginManager.get('logger');

      const writer = await logger.createWriter('create-log-write');
      writer.write('coucou'); // string
      writer.write({ a: 42 }); // object
      writer.write([0, 1, 2, 3]); // arrays
      writer.write(true); // primitives
      writer.write(new Float32Array([0, 1, 2])); // typed array

      await delay(100);

      const content = fs.readFileSync(writer.pathname).toString();
      const expected = `coucou\n{"a":42}\n[0,1,2,3]\ntrue\n[0,1,2]\n`;
      assert.equal(content, expected);
    });

    it(`should take given buffer size into account`, async () => {
      const client = new Client(config);
      client.pluginManager.register('logger', pluginLoggerClient);
      await client.start();
      const logger = await client.pluginManager.get('logger');

      const writer = await logger.createWriter('create-log-buffer', { bufferSize: 5 });
      writer.write('coucou'); // string
      writer.write({ a: 42 }); // object
      writer.write([0, 1, 2, 3]); // arrays
      writer.write(true); // primitives
      await delay(400);

      {
        const content = fs.readFileSync(writer.pathname).toString();
        const expected = ``;
        assert.equal(content, expected);
      }

      writer.write(new Float32Array([0, 1, 2])); // typed array

      await delay(100);
      {
        const content = fs.readFileSync(writer.pathname).toString();
        const expected = `coucou\n{"a":42}\n[0,1,2,3]\ntrue\n[0,1,2]\n`;
        assert.equal(content, expected);
      }
    });

    it(`client writers should not be shared`, async () => {
      const serverWriter = await serverLogger.createWriter('create-log-same-name');

      let clientWriter1;
      let clientWriter2;

      {
        const client = new Client(config);
        client.pluginManager.register('logger', pluginLoggerClient);
        await client.start();
        const logger = await client.pluginManager.get('logger');
        // values will be written after 5th call to write
        clientWriter1 = await logger.createWriter('create-log-same-name');
        clientWriter1.write('a');
      }

      {
        const client = new Client(config);
        client.pluginManager.register('logger', pluginLoggerClient);
        await client.start();
        const logger = await client.pluginManager.get('logger');
        // values will be written after 5th call to write
        clientWriter2 = await logger.createWriter('create-log-shared');
        clientWriter2.write('b');
      }

      serverWriter.write('c');
      await delay(300);

      {
        const content = fs.readFileSync(clientWriter1.pathname).toString();
        const expected = `a\n`;
        assert.equal(content, expected);
      }

      {
        const content = fs.readFileSync(clientWriter2.pathname).toString();
        const expected = `b\n`;
        assert.equal(content, expected);
      }

      {
        const content = fs.readFileSync(serverWriter.pathname).toString();
        const expected = `c\n`;
        assert.equal(content, expected);
      }
    });
  });

  describe(`# [created] async Writer.close()`, () => {
    it(`should close the writer`, async () => {
      const client = new Client(config);
      client.pluginManager.register('logger', pluginLoggerClient);
      await client.start();
      const logger = await client.pluginManager.get('logger');
      // values will be written after 5th call to write
      const writer = await logger.createWriter('create-log-close');
      writer.write('a');

      await writer.close();
      writer.write('b'); // should not be written

      await delay(100);

      const content = fs.readFileSync(writer.pathname).toString();
      const expected = `a\n`;
      assert.equal(content, expected);
    });

    it(`should flush the buffer`, async () => {
      const client = new Client(config);
      client.pluginManager.register('logger', pluginLoggerClient);
      await client.start();
      const logger = await client.pluginManager.get('logger');
      // values will be written after 5th call to write
      const writer = await logger.createWriter('create-log-close-flush', { bufferSize: 5 });
      writer.write('a');
      writer.write('a');
      writer.write('a');
      writer.write('a');

      {
        const content = fs.readFileSync(writer.pathname).toString();
        const expected = ``;
        assert.equal(content, expected);
      }

      await writer.close();
      await delay(100);

      {
        const content = fs.readFileSync(writer.pathname).toString();
        const expected = `a\na\na\na\n`;
        assert.equal(content, expected);
      }
    });
  });
});





















