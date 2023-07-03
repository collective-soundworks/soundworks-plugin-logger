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

    async stop() {
      // close all writers, can be done erver side actually...
      super.stop();
    }

    // @todo options
    // - bufferSize=1
    // - usePrefix=true
    // - allowReuse=false (only is use prefix === false)
    async createWriter(name, {
      bufferSize = 1,
      usePrefix = true,
      allowReuse = false
     } = {}) {
      return new Promise(async (resolve, reject) => {
        const state = await this.client.stateManager.create(`sw:plugin:${this.id}:writer`, {
          name,
          usePrefix,
          allowReuse,
        });

        // execute immediately as there may be concurrency issues with the server
        // `stateManager.observe` does not ganratee order of execution
        state.onUpdate(async updates => {
          let writer;

          if ('cmd' in updates && updates.cmd !== null) {
            switch (updates.cmd) {
              case 'ready': {
                writer = new WriterClient(state, bufferSize);
                resolve(writer);
                break;
              }
              // enable closing by the server
              case 'close': {
                writer.close();
                break;
              };
            }
          }

          if ('errored' in updates && updates.errored !== null) {
            if (writer) {
              await writer.close();
            } else {
              await state.delete();
            }

            reject(new Error(updates.errored));
          }
        }, true);
      });
    }

    // @todo options for API consistency
    // - bufferSize=1
    async attachWriter(name, { bufferSize = 1 } = {}) {
      const list = this._internalState.get('list');
      const stateId = list[name];

      if (stateId === undefined) {
        throw new Error(`[soundworks:PluginLogger] Cannot attach writer "${name}", writer does not exists`);
      }

      const writerState = await this.client.stateManager.attach(`sw:plugin:${this.id}:writer`, stateId);
      const writer = new WriterClient(writerState, bufferSize);

      return writer;
    }
  }

  return PluginLoggerClient;
}

