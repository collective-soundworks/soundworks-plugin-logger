import fs from 'node:fs';

import { assert } from 'chai';
import { delay } from '@ircam/sc-utils';

import { Server } from '@soundworks/core/server.js';
import pluginLoggerServer from '../src/PluginLoggerServer.js';

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
};

describe(`PluginLoggerServer`, () => {
  before(async () => {
    await fs.promises.rm('tests/logs', { recursive: true })
  });

  describe(`# [private] constructor(server, id, options)`, () => {
    // nothing to test
    it(`should throw if dirname is not a string`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, {
        dirname: 42,
      });

      let errored = false;
      try {
        await server.start();
      } catch (err) {
        errored = true;
        console.log(err.message);
      }

      if (!errored) {
        assert.fail('should have thrown');
      }
    });

    it(`should accept a string`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, {
        dirname: 'tests/logs',
      });

      await server.start();
      await server.stop();
    });

    it(`should accept null as dirname`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, {
        dirname: null,
      });

      await server.start();
      await server.stop();
    });
  });

  describe(`# async createWriter(name)`, () => {
    it(`should throw if logger is idle`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: null });
      await server.start();
      const logger = await server.pluginManager.get('logger');

      let errored = false;

      try {
        const writer = await logger.createWriter('coucou');
      } catch (err) {
        console.log(err.message);
        errored = true;
      }

      await server.stop();

      if (!errored) {
        assert.fail('should have thrown');
      }
    });

    it(`should throw if name is not a string is idle`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const logger = await server.pluginManager.get('logger');

      let errored = false;

      try {
        const writer = await logger.createWriter(42);
      } catch (err) {
        console.log(err.message);
        errored = true;
      }

      await server.stop();

      if (!errored) {
        assert.fail('should have thrown');
      }
    });

    it(`should throw if trying to create writer outside dirname`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const logger = await server.pluginManager.get('logger');

      let errored = false;

      try {
        const writer = await logger.createWriter('../coucou');
      } catch (err) {
        console.log(err.message);
        errored = true;
      }

      await server.stop();

      if (!errored) {
        assert.fail('should have thrown');
      }
    });

    // @note
    // cleaning file here does not work as fs.rmSync doesn't seems to work
    // while the writer has an opened file handle
    // we need to give each time a different file name

    it(`should return a Writer`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('coucou');

      assert.equal(writer.name, 'coucou');
      // file is prefixed with date
      assert.equal(writer.pathname.startsWith('tests/logs/'), true);
      assert.equal(writer.pathname.endsWith('_coucou.txt'), true);

      assert.equal(fs.existsSync(writer.pathname), true);

      await server.stop();
    });

    it(`should return a Writer - recursive`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('a/coucou');

      assert.equal(writer.name, 'a/coucou');
      // file is prefixed with date
      assert.equal(writer.pathname.startsWith('tests/logs/a/'), true);
      assert.equal(writer.pathname.endsWith('_coucou.txt'), true);

      assert.equal(fs.existsSync(writer.pathname), true);

      await server.stop();
    });

    it(`should return a Writer - usePrefix=false`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, {
        dirname: 'tests/logs',
        usePrefix: false,
      });

      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('a/coucou');

      assert.equal(writer.name, 'a/coucou');
      assert.equal(writer.pathname, 'tests/logs/a/coucou.txt');
      // file is not prefixed
      assert.equal(fs.existsSync('tests/logs/a/coucou.txt'), true);

      await server.stop();
    });

    it(`should not override extension if given`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, {
        dirname: 'tests/logs',
        usePrefix: false,
      });

      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('a/coucou.md');

      writer.write('niap');

      assert.equal(writer.name, 'a/coucou.md');
      // file is not prefixed and extensio is kept intact
      assert.isTrue(fs.existsSync('tests/logs/a/coucou.md'));

      await server.stop();
    });

    it(`writer should be added to internal lists`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });

      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('list.md');

      const list = logger._internalState.get('list');

      assert.isNumber(list['list.md']);
      assert.isTrue(logger._writers.get(server).has(writer));

      await server.stop();
      // clean the file
      fs.rmSync(writer.pathname);
    });
  });

  describe('# Writer.write(data)', () => {
    it(`should write simple message`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('server-test-write');

      writer.write('1');
      writer.write('2');
      writer.write('3');
      // write stream is not synchronous
      await delay(100);

      const result = fs.readFileSync(writer.pathname).toString();
      const expected = `1\n2\n3\n`;

      assert.equal(result, expected);

      await server.stop();
      fs.rmSync(writer.pathname);
    });

    it(`should stringify other messages (objects, arrays, primitives)`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('server-test-write');

      writer.write({ a: 42 });
      writer.write(true);
      writer.write([1, 2, 3]);
      // write stream is not synchronous
      await delay(100);

      const result = fs.readFileSync(writer.pathname).toString();
      const expected = `{"a":42}\ntrue\n[1,2,3]\n`;

      assert.equal(result, expected);

      await server.stop();
      fs.rmSync(writer.pathname);
    });

    it(`should convert typed array to array`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('server-test-write');

      writer.write(new Float32Array([1, 2, 3]));
      writer.write(new Uint8Array([4, 5, 6]));

      // write stream is not synchronous
      await delay(100);

      const result = fs.readFileSync(writer.pathname).toString();
      const expected = `[1,2,3]\n[4,5,6]\n`;

      assert.equal(result, expected);

      await server.stop();
      fs.rmSync(writer.pathname);
    });

    it(`should stringify Date too`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('server-test-write');

      const date = new Date();
      writer.write(date);

      // write stream is not synchronous
      await delay(100);

      const result = fs.readFileSync(writer.pathname).toString();
      assert.equal(result, JSON.stringify(date) + '\n');

      await server.stop();
      fs.rmSync(writer.pathname);
    });
  });

  describe(`# async Writer.close()`, () => {
    it(`should close the writer`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('server-test-close');

      writer.write('abcd');
      writer.write(42);
      await writer.close();
      // should resolve once the writer is close
      assert.equal(writer._stream.writable, false);
      // should have written all data
      const result = fs.readFileSync(writer.pathname).toString();
      const expected = `abcd\n42\n`;
      assert.equal(result, expected);

      await server.stop();
      fs.rmSync(writer.pathname);
    });

    it(`writer should be removed from internal lists`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('server-test-close');

      await writer.close();
      // should resolve once the writer is close
      const list = logger._internalState.get('list');
      assert.isUndefined(list['server-test-close']);
      assert.isFalse(logger._writers.get(server).has(writer));

      await server.stop();
      fs.rmSync(writer.pathname);
    });
  });
});


