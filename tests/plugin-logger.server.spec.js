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
};

describe(`PluginLoggerServer`, () => {
  before(async () => {
    if (fs.existsSync('tests/logs')) {
      await fs.promises.rm('tests/logs', { recursive: true })
    }

    if (fs.existsSync('tests/switch')) {
      await fs.promises.rm('tests/switch', { recursive: true })
    }
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
        const writer = await logger.createWriter('fail');
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
        const writer = await logger.createWriter('../outside');
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
    //
    // Cleaning the files here does not work as `fs.rmSync` doesn't seem to work
    // while the writer has an opened file handle.
    // The we need to give each time a different file name.

    it(`should return a Writer`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('default_options');

      assert.equal(writer.name, 'default_options');
      // file is prefixed
      assert.equal(writer.pathname.startsWith('tests/logs/'), true);
      assert.equal(writer.pathname.endsWith('_default_options.txt'), true);
      assert.equal(fs.existsSync(writer.pathname), true);

      await server.stop();
    });

    it(`should return a Writer - recursive`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('inner/create_writer_recursive');

      assert.equal(writer.name, 'inner/create_writer_recursive');
      // file is prefixed
      assert.equal(writer.pathname.startsWith('tests/logs/inner/'), true);
      assert.equal(writer.pathname.endsWith('_create_writer_recursive.txt'), true);

      assert.equal(fs.existsSync(writer.pathname), true);

      await server.stop();
    });

    it(`writer should be added to internal lists`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });

      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('in_list.md');

      const list = logger._internalState.get('list');

      assert.isNumber(list['in_list.md']);
      assert.isTrue(logger._nodeIdWritersMap.get(server.id).has(writer));

      await server.stop();
      // clean the file
      fs.rmSync(writer.pathname);
    });

    it(`should not override extension if given`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('create_writer_keep_ext.md', { usePrefix: false });

      assert.equal(writer.name, 'create_writer_keep_ext.md');
      // file is not prefixed and extension is kept intact
      assert.isTrue(fs.existsSync('tests/logs/create_writer_keep_ext.md'));

      await server.stop();
    });

    it(`usePrefix=false`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('create_writer_no_prefix', { usePrefix: false });

      assert.equal(writer.name, 'create_writer_no_prefix');
      assert.equal(writer.pathname, 'tests/logs/create_writer_no_prefix.txt');
      // file is not prefixed
      assert.equal(fs.existsSync('tests/logs/create_writer_no_prefix.txt'), true);

      await server.stop();
    });

    it(`usePrefix=false, alllowReuse=true`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const logger = await server.pluginManager.get('logger');

      {
        const writer = await logger.createWriter('create_writer_allow_reuse', {
          usePrefix: false,
          allowReuse: true,
        });
        writer.write('a');
        await writer.close();
      }

      await delay(100);

      { // same server reuse file
        const writer = await logger.createWriter('create_writer_allow_reuse', {
          usePrefix: false,
          allowReuse: true,
        });
        writer.write('b');
        await writer.close();
      }

      await server.stop();

      await delay(100);

      const result = fs.readFileSync('tests/logs/create_writer_allow_reuse.txt').toString();
      const expected = `a\nb\n`;
      assert.equal(result, expected);

      // or whole new server
      {
        const server = new Server(config);
        server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
        await server.start();
        const logger = await server.pluginManager.get('logger');

        const writer = await logger.createWriter('create_writer_allow_reuse', {
          usePrefix: false,
          allowReuse: true,
        });
        writer.write('c');
        await writer.close();

        await delay(100);
        await server.stop();

        const result = fs.readFileSync('tests/logs/create_writer_allow_reuse.txt').toString();
        const expected = `a\nb\nc\n`;
        assert.equal(result, expected);
      }
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
      assert.isFalse(logger._nodeIdWritersMap.get(server.id).has(writer));

      await server.stop();
      fs.rmSync(writer.pathname);
    });
  });

  describe(`# Writer.onClose(callback)`, () => {
    it(`should have consistent order of execution`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const logger = await server.pluginManager.get('logger');
      const writer = await logger.createWriter('server-test-onclose');

      let step = 0;
      let onCloseExecuted = false;

      // callback should be executed before `close` resolves
      writer.onClose(async () => {
        delay(100);
        onCloseExecuted = true;
        step += 1;
        assert.equal(step, 1);
      });

      await writer.close();

      step += 1;
      assert.equal(step, 2);
      assert.isTrue(onCloseExecuted);

      await server.stop();
      fs.rmSync(writer.pathname);
    });
  });

  describe('switch(dirnname)', () => {
    it(`should accepet string or object (see plugin-filesystem and plugin-scripting)`, async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer);
      await server.start();
      const logger = await server.pluginManager.get('logger');

      await logger.switch({ dirname: 'tests/logs' });
      assert.equal(logger.options.dirname, 'tests/logs');
      await logger.switch('tests/switch');
      assert.equal(logger.options.dirname, 'tests/switch');

      await server.stop();
    })

    it('should behave as expected', async () => {
      const server = new Server(config);
      server.pluginManager.register('logger', pluginLoggerServer, { dirname: 'tests/logs' });
      await server.start();
      const serverLogger = await server.pluginManager.get('logger');

      const client = new Client({ role: 'test', ...config });
      client.pluginManager.register('logger', pluginLoggerClient);
      await client.start();
      const clientLogger = await client.pluginManager.get('logger');

      let serverOnCloseCalled = false;
      let clientOnCloseCalled = false;
      {
        const serverWriter = await serverLogger.createWriter('server-switch-test-server');
        serverWriter.onClose(() => serverOnCloseCalled = true);
        const clientWriter = await clientLogger.createWriter('server-switch-test-client');
        clientWriter.onClose(() => clientOnCloseCalled = true);
      }

      assert.equal(serverLogger._nodeIdWritersMap.size, 2);
      assert.equal(serverLogger._pathnameWriterMap.size, 2);

      await serverLogger.switch(null);
      // the client writer.close is triggered from remote
      await delay(100);

      // on close methods have properly been called
      assert.isTrue(serverOnCloseCalled);
      assert.isTrue(clientOnCloseCalled);
      // make sure all writers (and streams) have been closed, as this could not
      // be the case for the server-side writer of the client instance.
      // As writers are removed from the different maps in their `beforeClose`
      // callbacks, we know all writers have been properly close server side too.
      assert.equal(serverLogger._nodeIdWritersMap.size, 2);
      serverLogger._nodeIdWritersMap.forEach(writers => {
        assert.equal(writers.size, 0);
      });
      assert.equal(serverLogger._pathnameWriterMap.size, 0);

      // switch to another lgo directory
      await serverLogger.switch('tests/switch');

      let serverWriter;
      let clientWriter;

      {
        serverWriter = await serverLogger.createWriter('server-switch-test-server', {
          usePrefix: false,
        });
        clientWriter = await clientLogger.createWriter('server-switch-test-client', {
          usePrefix: false,
        });
      }

      assert.equal(serverWriter.pathname, 'tests/switch/server-switch-test-server.txt');
      assert.isTrue(fs.existsSync('tests/switch/server-switch-test-server.txt'));

      assert.equal(clientWriter.pathname, 'tests/switch/server-switch-test-client.txt');
      assert.isTrue(fs.existsSync('tests/switch/server-switch-test-client.txt'))

      await client.stop();
      await server.stop();
    });
  });
});


