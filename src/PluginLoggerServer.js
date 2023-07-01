import fs from 'node:fs';
import path from 'node:path';

import { idGenerator, isString } from '@ircam/sc-utils';

import Writer from './WriterServer.js';

const generator = idGenerator();

/**
 * Pad a string with a prefix.
 * @param {String} prefix
 * @param {String} radical
 * @returns {String} concatenation of prefix + radical, sliced to the minimum of
 *  the prefix or radical size.
 *
 * @private
 */
export function pad(prefix, radical) {
  const string = typeof radical === 'string' ? radical : radical.toString();
  const slice = string.length > prefix.length ? prefix.length : -prefix.length;

  return (prefix + string).slice(slice);
}

/**
 * Returns a date suitable for a file name.
 * @returns {String} date as YYYYMMDD_hhmmss
 * @private
 */
export function date() {
  const date = new Date();

  const year = date.getFullYear();
  const month = pad('00', date.getMonth() + 1); // Month starts at 0
  const day = pad('00', date.getDate());

  const hours = pad('00', date.getHours());
  const minutes = pad('00', date.getMinutes());
  const seconds = pad('00', date.getSeconds());

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

const internalSchema = {
  // <name, stateId> list of the writers created by the server
  list: {
    type: 'any',
    default: {},
  },
};

const writerSchema = {
  // id: {
  //   type: 'integer',
  //   default: -1,
  // },
  // nodeId: {
  //   type: 'integer',
  //   default: -1,
  // },
  name: {
    type: 'string',
    default: '',
  },
  pathname: {
    type: 'string',
    default: '',
  },
  data: {
    type: 'any',
    event: true,
  },
  // propagate errors client-side
  error: {
    type: 'string',
    default: null,
    nullable: true,
  },
};

// keep a list of the writers create by the server

export default function(Plugin) {

  class PluginLoggerServer extends Plugin {
    constructor(server, id, options) {
      super(server, id);

      const defaults = {
        dirname: null,
        // add YYYYMMDD_hhmmss prefix to all writers filenames
        usePrefix: true,
      };

      this.options = Object.assign(defaults, options);
      this._writers = new Map(); // <node, writers>
    }

    /** @private */
    async start() {
      await super.start();
      //
      this.server.stateManager.registerSchema(`sw:plugin:${this.id}:internal`, internalSchema);
      this._internalState = await this.server.stateManager.create(`sw:plugin:${this.id}:internal`);

      this.server.stateManager.registerSchema(`sw:plugin:${this.id}:writer`, writerSchema);
      // observe writter states created by clients
      this.server.stateManager.observe(`sw:plugin:${this.id}:writer`, (schemaName, stateId) => {
        // attach to state and create writer
      });

      // move to switch
      if (this.options.dirname !== null && !isString(this.options.dirname)) {
        throw new Error(`[soundworks:PluginLogger] Invalid option "dirname", should be string or null`);
      }

      if (this.options.dirname === null) {
        return;
      }

      if (!fs.existsSync(this.options.dirname)) {
        try {
          fs.mkdirSync(this.options.dirname, { recursive: true });
        } catch(error) {
          console.error(`[soundworks:PluginLogger] Error while creating "${this.options.dirname}" directory: ${error.message}`);
          throw error;
        }
      }
    }

    /** @private */
    async stop() {
      // close all writers
      await super.stop();
    }

    /** @private */
    async addClient(client) {
      await super.addClient(client);

      // client.socket.addListener(`sw:plugin:${this.id}:data`, (data) => {
      //   const { id, payload } = data;
      //   const writer = this._writers.get(id);
      //   payload.forEach(entry => writer.write(entry));
      // });
    }

    /** @private */
    async removeClient(client) {
      // client.socket.removeAllListeners(`sw:plugin:${this.id}:data`);
      await super.removeClient();
    }

    async switch(dirname) {
      throw new Error('@todo implement');
      // close all existing states
        // be carefull with flushing
      // update this.options.dirname
      // create new directory
    }

    /**
     * Create a writer
     * @param {String} name - Name of the writer
     */
    async createWriter(name) {
      // @todo - refactor, handle writers created by clients

      if (this.options.dirname === null) {
        throw new Error('[soundworks:PluginLogger] Cannot create writer, plugin is in "idle" state, call "logger.switch(dirname)" to activate the plugin');
      }

      if (!isString(name)) {
        throw new Error(`[soundworks:PluginLogger] Invalid argument for "logger.createWriter(name)", "name" must be a string`);
      }

      const dirname = path.join(this.options.dirname, path.dirname(name));
      const relPath = path.relative(this.options.dirname, dirname);

      if (relPath.startsWith('..')) {
        throw new Error(`[soundworks:PluginLogger] Invalid argument for "logger.createWriter(name)", cannot create writer outside directory`);
      }

      let extname = path.extname(name);
      let basename = path.basename(name, extname);
      // default to .txt if not given
      if (extname === '' || extname === '.') {
        extname = '.txt';
      }

      if (this.options.usePrefix === true) {
        basename = `${date()}_${basename}`;
      }

      const pathname = path.join(dirname, `${basename}${extname}`);

      // create underlying writer state
      const writerState = await this.server.stateManager.create(`sw:plugin:${this.id}:writer`, {
        name,
        pathname,
      });

      // create writer
      const writer = new Writer(writerState);
      await writer.open();

      const node = this.server;

      // clients should able to write in writers created by the server
      writerState.onUpdate(updates => {
        if ('data' in updates) {
          // unpack buffer
          updates.data.forEach(datum => writer.write(datum));
        }
      });

      // store writer so it can be used from remote
      writer.onClose = async () => {
        // delete from internal list
        const list = this._internalState.get('list');
        delete list[name];
        await this._internalState.set({ list });
        // delete state
        await writerState.delete();
        // remove from writers
        const writers = this._writers.get(node);
        writers.delete(writer);
      };

      // store writer in writers
      if (!this._writers.has(node)) {
        this._writers.set(node, new Set());
      }

      const writers = this._writers.get(node);
      writers.add(writer);

      // add to global writer list
      const list = this._internalState.get('list');
      list[name] = writerState.id;
      await this._internalState.set({ list });

      return writer;
    }
  }

  return PluginLoggerServer;
}
