import WriterClient from './WriterClient.js';

export default function(Plugin) {

  class PluginLoggerClient extends Plugin {
    constructor(client, id, options) {
      super(client, id);

      const defaults = {};
      this.options = Object.assign(defaults, options);

      this._internalState = null;
    }

    async start() {
      this._internalState = await this.client.stateManager.attach(`sw:plugin:${this.id}:internal`);

      super.start();
    }

    // async stop() {
    //   // close all writers, can be done erver side actually...
    //   super.stop();
    // }

    // async create(name, options = {}) {
    //   return new Promise((resolve, reject) => {
    //     try {
    //       const state = await this.client.stateManager.create(`sw:plugin:${this.id}:writer`, {
    //         nodeId: this.client.id,
    //         name: name,
    //       });

    //       state.onUpdate(updates => {
    //         if ('id' in updates) {
    //           const writer = new Writer();
    //           resolve(writer);
    //         }
    //       }, true);

    //     } catch (err) {
    //       reject(new Error(`[PluginLogger] Cannot create writer: ${err.message}`));
    //     }
    //   });
    // }

    async attachWriter(name, bufferSize = 1) {
      const list = this._internalState.get('list');
      const stateId = list[name];

      if (stateId === undefined) {
        throw new Error(`[soundworks:PluginLogger] Cannot attach writer "${name}", writer does not exists`);
      }

      const writerState = await this.client.stateManager.attach(`sw:plugin:${this.id}:writer`, stateId);
      const writer = new WriterClient(writerState, bufferSize);

      return writer;

      // return new Promise((resolve, reject) => {
      //   // const ackChannel
      //   this.client.socket.addListener(`s:${this.id}:attach:${name}`, writerId => {
      //     this.client.socket.removeAllListeners(`s:${this.id}:attach:${name}`);
      //     this.client.socket.removeAllListeners(`s:${this.id}:attach-error:${name}`);

      //     const writer = new Writer(this.id, this.client, _owner, name, writerId, options);
      //     resolve(writer);
      //   });

      //   this.client.socket.addListener(`s:${this.id}:attach-error:${name}`, () => {
      //     this.client.socket.removeAllListeners(`s:${this.id}:attach:${name}`);
      //     this.client.socket.removeAllListeners(`s:${this.id}:attach-error:${name}`);

      //     reject(`[logger error] writer ${name} does not exists`);
      //   });

      //   this.client.socket.send(`s:${this.id}:attach`, name);
      // });
    }
  }

  return PluginLoggerClient;
}

