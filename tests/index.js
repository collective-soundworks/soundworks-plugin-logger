const path = require('path');
const Server = require('@soundworks/core/server').Server;
const ServerAbstractExperience = require('@soundworks/core/server').AbstractExperience;
const Client = require('@soundworks/core/client').Client;
const ClientAbstractExperience = require('@soundworks/core/client').AbstractExperience;
const serverPluginFactory = require('../server').default;
const clientPluginFactory = require('../client').default;

const assert = require('assert');
const fs = require('fs');
const os = require('os')

// mixed config for server and client
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
    "type": "development",
    "port": 8081,
    "assetsDomain": "",
    "serverIp": "127.0.0.1",
    "websockets": {
      "path": "socket",
      "url": "",
      "pingInterval": 5000
    },
    "useHttps": false,
    "httpsInfos": {
      "key": null,
      "cert": null,
    },
  },

  // client only config
  clientType: 'test',
};

class ServerTestExperience extends ServerAbstractExperience {
  constructor(server, clientTypes) {
    super(server, clientTypes);
    this.logger = this.require('logger');
  }

  async start() {
    console.log('[server] experience started');

    const writer = await this.logger.create('server-logger.txt');
    const streamPath = writer.streamPath;

    let result = '';
    // write some data
    for (let i = 0; i < 10; i++) {
      const msg = `server-${i}`;

      writer.write(msg);
      result += msg + os.EOL;
    }

    await writer.close(); // should be async

    const loggedData = fs.readFileSync(streamPath).toString();
    assert.equal(loggedData, result, 'should properly write data');
    assert.throws(() => writer.write(`server-crash`), 'should properly write data');
  }

  enter(client) {
    super.enter(client);

    console.log(`[server] client ${client.id} connected`);


    // const writer = Array.from(this.writers).find(w => w.name === name);
    // writer.streamPath;
  }
}

class ClientTestExperience extends ClientAbstractExperience {
  constructor(client) {
    super(client);
    this.logger = this.require('logger');
  }

  start() {
    super.start();

    console.log('[client] experience started');
    console.log(`[client] client ${this.client.id}`);
  }
}

// runner
(async function() {
  // ---------------------------------------------------
  // server
  // ---------------------------------------------------
  const server = new Server();

  // this is boring... should not be mandatory
  server.templateEngine = { compile: () => {} };
  server.templateDirectory = process.cwd();

  server.pluginManager.register('logger', serverPluginFactory, {
    directory: path.join(process.cwd(), 'logs'),
  });
  await server.init(config);
  const serverTestExperience = new ServerTestExperience(server, 'test');

  await server.start();
  serverTestExperience.start();

  // ---------------------------------------------------
  // client
  // ---------------------------------------------------
  const client = new Client();
  client.pluginManager.register('logger', serverPluginFactory, {
    directory: path.join(process.cwd(), 'logs'),
  });

  await client.init(config);
  const clientTestExperience = new ClientTestExperience(client);

  await client.start();
  clientTestExperience.start();

  // later... (to implement)
  // await server.stop();
  // await client.stop();
}());





process.on('unhandledRejection', (reason, p) => {
  console.log('> Unhandled Promise Rejection');
  console.log(reason);
});

// process.on('exit', (code) => {
//   console.log('> closing process');
// });



























