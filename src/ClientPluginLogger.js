import { ClientPlugin } from '@soundworks/core/client.js';
import ClientWriter from './ClientWriter.js';

/**
 * Client-side representation of the soundworks sync plugin.
 *
 * The constructor should never be called manually. The plugin will be
 * instantiated by soundworks when registered in the `pluginManager`
 *
 * @example
 * client.pluginManager.register('logger', ClientPluginLogger);
 */
export default class ClientPluginLogger extends ClientPlugin {
  #internalState = null;

  /** @hideconstructor */
  constructor(client, id, options) {
    super(client, id);

    const defaults = {};
    this.options = Object.assign(defaults, options);
  }

  /** @private */
  async start() {
    this.#internalState = await this.client.stateManager.attach(`sw:plugin:${this.id}:internal`);

    super.start();
  }

  /** @private */
  async stop() {
    // closing all the writers is done server-side
    super.stop();
  }

  /**
   * Create a writer.
   *
   * @param {String} name - Name of the writer. Used to generate the log file
   *  pathname.
   * @param {Object} options - Options for the writer.
   * @param {Number} [options.bufferSize=1] - Number of writes buffered before
   *  sending the logs to the server.
   * @param {Boolean} [options.usePrefix=true] - Whether the writer file should
   *  be prefixed with a `YYYY.MM.DD_hh.mm.ss_uid_` string.
   * @param {Boolean} [options.allowReuse=false] - If `usePrefix` is false, allow
   *  to reuse an existing underlying file for the writer. New data will be
   *  appended to the file.
   *  Can be useful to log global information in the same file amongst different
   *  sessions.
   */
  async createWriter(name, {
    bufferSize = 1,
    usePrefix = true,
    allowReuse = false,
  } = {}) {
    const state = await this.client.stateManager.create(`sw:plugin:${this.id}:writer`, {
      name,
      usePrefix,
      allowReuse,
    });

    let writer;

    return new Promise((resolve, reject) => {
      // execute immediately as there may be concurrency issues with the server
      // `stateManager.observe` does not guarantee order of execution
      state.onUpdate(async updates => {
        if ('cmd' in updates && updates.cmd !== null) {
          switch (updates.cmd) {
            case 'ready': {
              writer = new ClientWriter(this, state, bufferSize);
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
   * Attach to a shared writer created by the server. Can be useful to create
   * files that gather information from multiple nodes.
   *
   * @param {String} name - Name of the writer. Used to generate the log file
   *  pathname.
   * @param {Object} options - Options for the writer.
   * @param {Number} [options.bufferSize=1] - Number of writes buffered before
   *  sending the logs to the server.
   */
  async attachWriter(name, { bufferSize = 1 } = {}) {
    const list = this.#internalState.get('list');
    const stateId = list[name];

    if (stateId === undefined) {
      throw new Error(`Cannot execute 'attach' on ClientPluginLogger: Cannot attach writer '${name}', writer does not exists`);
    }

    const writerState = await this.client.stateManager.attach(`sw:plugin:${this.id}:writer`, stateId);
    const writer = new ClientWriter(this, writerState, bufferSize);

    return writer;
  }
}

