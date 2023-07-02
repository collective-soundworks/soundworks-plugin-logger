import fs from 'node:fs';
import path from 'node:path';

import { isString, idGenerator } from '@ircam/sc-utils';

import WriterServer from './WriterServer.js';

const ids = idGenerator();


/**
 * Pad a string with a prefix.
 * @param {String} prefix
 * @param {String} radical
 * @returns {String} concatenation of prefix + radical, sliced to the minimum of
 *  the prefix or radical size. (@note - this is not true)
 *
 * @private
 */
function pad(prefix, radical) {
  const string = typeof radical === 'string' ? radical : radical.toString();
  const slice = string.length > prefix.length ? prefix.length : -prefix.length;

  return (prefix + string).slice(slice);
}

/**
 * Returns a readable prefix suitable for a file name with date and unique Id
 * @returns {String} prefix as YYYY.MM.DD_hh.mm.ss_uid_
 * @private
 */
function prefix() {
  const date = new Date();

  const year = date.getFullYear();
  const month = pad('00', date.getMonth() + 1); // Month starts at 0
  const day = pad('00', date.getDate());

  const hours = pad('00', date.getHours());
  const minutes = pad('00', date.getMinutes());
  const seconds = pad('00', date.getSeconds());
  // more robust than using millisesconds which could eventually be the same
  const id = pad('0000', ids.next().value);

  return `${year}.${month}.${day}_${hours}.${minutes}.${seconds}_${id}_`;
}

const internalSchema = {
  // <name, stateId> list of the writers created by the server
  list: {
    type: 'any',
    default: {},
  },
};

const writerSchema = {
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
  usePrefix: {
    type: 'boolean',
    default: true,
  },
  // propagate errors client-side
  errored: {
    type: 'string',
    default: null,
    nullable: true,
  },

  cmd: {
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
      };

      this.options = Object.assign(defaults, options);
      this._writers = new Map(); // <node, writers>

      this.server.stateManager.registerSchema(`sw:plugin:${this.id}:internal`, internalSchema);
      this.server.stateManager.registerSchema(`sw:plugin:${this.id}:writer`, writerSchema);
    }

    /** @private */
    async start() {
      await super.start();

      // list of server side writer on which clients can attach
      this._internalState = await this.server.stateManager.create(`sw:plugin:${this.id}:internal`);

      // observe writter states created by clients
      this.server.stateManager.observe(
        `sw:plugin:${this.id}:writer`,
        async (schemaName, stateId, nodeId) => {
          // attach to state and create writer
          const state = await this.server.stateManager.attach(schemaName, stateId);
          const name = state.get('name');
          const usePrefix = state.get('usePrefix');
          let pathname = null;

          try {
            pathname = this._getPathname(name, usePrefix);
          } catch (err) {
            state.set({ errored: err.message });
            return;
          }
          // pathname is required by `writer.open()`, must be set before hand
          await state.set({ pathname });
          // writer.open can throw too, e.g. file exists
          try {
            await this._createAndRegisterWriter(nodeId, state, false);
          } catch (err) {
            state.set({ errored: err.message });
            return;
          }
          // everything is ready, notify client that it can finish the instantiation
          await state.set({ cmd: 'ready' });
        }
      );

      await this.switch(this.options.dirname);
    }

    /** @private */
    async stop() {
      // close all writers
      await super.stop();
    }

    /** @private */
    async addClient(client) {
      await super.addClient(client);
    }

    /** @private */
    async removeClient(client) {
      // delete all writers from this client
      await super.removeClient();
    }

    /**
     * Return a full pathname form a writer name
     * @private
     */
    _getPathname(name, usePrefix = true) {
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

      if (usePrefix === true) {
        basename = `${prefix()}${basename}`;
      }

      const pathname = path.join(dirname, `${basename}${extname}`);

      return pathname;
    }

    async _createAndRegisterWriter(nodeId, state, recordInList = false) {
      const name = state.get('name');
      // initialize the writer
      const writer = new WriterServer(state);
      await writer.open();

      // clean state and storages when the writer is closed
      writer.onClose = async () => {
        // delete from internal list
        if (recordInList) {
          const list = this._internalState.get('list');
          delete list[name];
          await this._internalState.set({ list });
        }
        // delete state
        await state.delete();
        // remove from writers
        const writers = this._writers.get(nodeId);
        writers.delete(writer);
      };

      // store writer in writers
      if (!this._writers.has(nodeId)) {
        this._writers.set(nodeId, new Set());
      }

      // store the writer
      const writers = this._writers.get(nodeId);
      writers.add(writer);

      // record server-side writers in global list
      if (recordInList) {
        const list = this._internalState.get('list');
        list[name] = state.id;
        await this._internalState.set({ list });
      }

      // pipe data from client to the writer
      state.onUpdate(updates => {
        if ('data' in updates) {
          updates.data.forEach(datum => writer.write(datum));
        }
      });

      return writer;
    }

    /**
     * Helper that just return a string of yyyymmdd to help naming directories
     */
    getDatedPrefix() {
      // @todo
    }

    async switch(dirname) {
      // close all existing writers
      // be carefull with flushing

      if (dirname !== null && !isString(dirname)) {
        throw new Error(`[soundworks:PluginLogger] Invalid option "dirname", should be string or null`);
      }

      this.options.dirname = dirname;

      if (dirname === null) {
        return;
      }

      if (!fs.existsSync(dirname)) {
        try {
          fs.mkdirSync(dirname, { recursive: true });
        } catch(error) {
          throw new Error(`[soundworks:PluginLogger] Error while creating "${dirname}" directory: ${error.message}`);
        }
      }
    }

    /**
     * Create a writer
     * @param {String} name - Name of the writer
     * @param {Object} options - Options for the writer
     * @param {Boolean} [usePrefix=true] - Whether the writer file should be prefixed
     *  with a `YYYY.MM.DD_hh.mm.ss_uid_` string.
     */
    // @todo - options
    // - usePrefix=true
    // - allowReuse=false (only is use prefix === false)
    async createWriter(name, { usePrefix = true } = {}) {
      const pathname = this._getPathname(name, usePrefix);

      // create underlying writer state
      const writerState = await this.server.stateManager.create(`sw:plugin:${this.id}:writer`, {
        name,
        pathname,
      });

      const writer = await this._createAndRegisterWriter(this.server.id, writerState, true);

      return writer;
    }
  }

  return PluginLoggerServer;
}
