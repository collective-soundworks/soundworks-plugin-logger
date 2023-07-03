import WriterClient from './WriterClient.js';

export default function(Plugin) {

  class PluginLoggerClient extends Plugin {
    constructor(client, id, options) {
      super(client, id);

      const defaults = {};
      this.options = Object.assign(defaults, options);

      this._internalState = null;
    }

    /** @private */
    async start() {
      this._internalState = await this.client.stateManager.attach(`sw:plugin:${this.id}:internal`);

      super.start();
    }

    /** @private */
    async stop() {
      // close all writers, can be done erver side actually...
      super.stop();
    }

    /**
     * Create a writer
     * @param {String} name - Name of the writer.
     * @param {Object} options - Options for the writer.
     * @param {Number} [bufferSize=1] - Number of writes buffered before sending
     *  the logs to the server.
     * @param {Boolean} [usePrefix=true] - Whether the writer file should be prefixed
     *  with a `YYYY.MM.DD_hh.mm.ss_uid_` string.
     * @param {Boolean} [allowReuse=false] - If `usePrefix` is false, allow to reuse an
     *  existing underlying file for the writer. New data will be appended to the file.
     *  Can be usefull to log global informations in the same file amongst different
     *  sessions.
     */
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

        let writer;
        // execute immediately as there may be concurrency issues with the server
        // `stateManager.observe` does not ganratee order of execution
        state.onUpdate(async updates => {

          if ('cmd' in updates && updates.cmd !== null) {
            switch (updates.cmd) {
              case 'ready': {
                writer = new WriterClient(this, state, bufferSize);
                resolve(writer);
                break;
              }
              // enable closing by the server, i.e. in case of switch
              case 'close': {
                await writer.close();
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

    /**
     * Attach to a shared writer created by the server. Can be usefull to create
     * files that gather informations from multiple nodes.
     * @param {String} name - Name of the writer.
     * @param {Object} options - Options for the writer.
     * @param {Number} [bufferSize=1] - Number of writes buffered before sending
     *  the logs to the server.
     */
    async attachWriter(name, { bufferSize = 1 } = {}) {
      const list = this._internalState.get('list');
      const stateId = list[name];

      if (stateId === undefined) {
        throw new Error(`[soundworks:PluginLogger] Cannot attach writer "${name}", writer does not exists`);
      }

      const writerState = await this.client.stateManager.attach(`sw:plugin:${this.id}:writer`, stateId);
      const writer = new WriterClient(this, writerState, bufferSize);

      return writer;
    }
  }

  return PluginLoggerClient;
}

