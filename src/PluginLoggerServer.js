import fs from 'node:fs';
import path from 'node:path';

import { isString, isPlainObject, idGenerator } from '@ircam/sc-utils';

import WriterServer from './WriterServer.js';

const ids = idGenerator();


/**
 * Pad a string with a prefix.
 * @param {String} prefix
 * @param {String} radical
 * @returns {String} concatenation of prefix + radical, sliced to the minimum of
 *  the prefix or radical size. (@note - this is not true)
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
  // writer options
  usePrefix: {
    type: 'boolean',
    default: true,
  },
  allowReuse: {
    type: 'boolean',
    default: false,
  },
  // propagate errors client-side
  errored: {
    type: 'string',
    default: null,
    nullable: true,
  },
  // commands for clients
  cmd: {
    type: 'string',
    default: null,
    nullable: true,
  },
};

export default function(Plugin) {
  /**
   * Server-side representation of the soundworks logger plugin.
   */
  class PluginLoggerServer extends Plugin {
    /**
     * The constructor should never be called manually. The plugin will be
     * instantiated by soundworks when registered in the `pluginManager`
     *
     * Available options:
     * - `[dirname=null]` {String} - The directory in which the log files should
     *  be created. If `null` the plugin is in some "idle" state, and any call
     *  to `createWriter` (or client-side `attachWriter`) will throw an error.
     *  The directory can be changed at runtime usin the `switch` method.
     *
     * @example
     * server.pluginManager.register('logger', pluginLogger, {
     *   dirname: 'my-logs',
     * });
     */
    constructor(server, id, options) {
      super(server, id);

      const defaults = {
        dirname: null,
      };

      this.options = Object.assign(defaults, options);
      this._nodeIdWritersMap = new Map(); // <node, writers>
      this._pathnameWriterMap = new Map(); // <pathname, writer>

      this.server.stateManager.registerSchema(`sw:plugin:${this.id}:internal`, internalSchema);
      this.server.stateManager.registerSchema(`sw:plugin:${this.id}:writer`, writerSchema);
    }

    /** @private */
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

    /** @private */
    async _createAndRegisterWriter(nodeId, state) {
      const name = state.get('name');
      // initialize the writer
      const writer = new WriterServer(state);
      // clean state and storages when the writer is closed
      writer.beforeClose = async () => {
        // only server-side created writers are recorded in global list
        if (nodeId === this.server.id) {
          // delete from internal list
          const list = this._internalState.get('list');
          delete list[name];
          await this._internalState.set({ list });
        }

        // remove from writers from the different maps
        this._pathnameWriterMap.delete(writer.pathname);
        this._nodeIdWritersMap.get(nodeId).delete(writer);
      };

      await writer.open();

      // store the writer in the different maps
      this._pathnameWriterMap.set(writer.pathname, writer);

      if (!this._nodeIdWritersMap.has(nodeId)) {
        this._nodeIdWritersMap.set(nodeId, new Set());
      }

      this._nodeIdWritersMap.get(nodeId).add(writer);

      // record server-side writers in global list
      if (nodeId === this.server.id) {
        const list = this._internalState.get('list');
        list[name] = state.id;
        await this._internalState.set({ list });
      }

      return writer;
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
          let writer = null;
          // writer.open can throw too, e.g. file exists
          try {
            writer = await this._createAndRegisterWriter(nodeId, state);
            state.onDetach(async () => {
              await writer.close()
            });
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

      // pipe data sent from the client to the right writer
      client.socket.addListener(`sw:plugin:${this.id}:data`, msg => {
        const { pathname, data } = msg;
        // we need this check because the client may still send some data in attached
        // writer, between call to  WriterServer.close() and the actual detach on client
        if (this._pathnameWriterMap.has(pathname)) {
          const writer = this._pathnameWriterMap.get(pathname);
          data.forEach(datum => writer.write(datum))
        }
      });
    }

    /** @private */
    async removeClient(client) {
      client.socket.removeAllListeners(`sw:plugin:${this.id}:data`);
      // delete all writers owned by this client
      // calling `close`` will clean the maps
      const writers = this._nodeIdWritersMap.get(client.id);
      // await so that close don't try to acces an empty this._nodeIdWritersMap set
      for (let writer of writers) {
        await writer.close();
      }

      this._nodeIdWritersMap.delete(client.id);

      await super.removeClient();
    }

    /**
     * Change the directory in which the log files are created. Closes all existing writers.
     *
     * @param {String|Object} dirname - Path to the new directory. As a convenience
     *  to match the plugin filesystem API, an object containing the 'dirname' key
     *  can also be passed.
     */
    async switch(dirname) {
      // support switch({ dirname }) API to match filesystem API
      if (isPlainObject(dirname)) {
        if (!('dirname' in dirname)) {
          throw new Error(`[soundworks:PluginScripting] Invalid argument for method switch, argument should contain a "dirname" key`);
        }

        dirname = dirname.dirname;
      }

      // @todo - be carefull with flushing for now it will just be a "do what you can" startegy
      if (dirname !== null && !isString(dirname)) {
        throw new Error(`[soundworks:PluginLogger] Invalid option "dirname", should be string or null`);
      }

      this.options.dirname = dirname;

      // close all existing writers
      for (let [nodeId, writers] of this._nodeIdWritersMap.entries()) {
        for (let writer of writers) {
          if (nodeId === this.server.id) {
            await writer.close();
          } else {
            await writer._state.set({ cmd: 'close' });
          }
        }
      }

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
     * Create a writer.
     * @param {String} name - Name of the writer. Used to generate the log file
     *  pathname.
     * @param {Object} options - Options for the writer.
     * @param {Boolean} [options.usePrefix=true] - Whether the writer file should
     *  be prefixed with a `YYYY.MM.DD_hh.mm.ss_uid_` string.
     * @param {Boolean} [options.allowReuse=false] - If `usePrefix` is false, allow
     *  to reuse an existing underlying file for the writer. New data will be
     *  appended to the file.
     *  Can be usefull to log global informations in the same file amongst different
     *  sessions.
     */
    async createWriter(name, {
      usePrefix = true,
      allowReuse = false,
    } = {}) {
      const pathname = this._getPathname(name, usePrefix);

      // create underlying writer state
      const writerState = await this.server.stateManager.create(`sw:plugin:${this.id}:writer`, {
        name,
        pathname,
        usePrefix,
        allowReuse,
      });

      const writer = await this._createAndRegisterWriter(this.server.id, writerState);

      return writer;
    }
  }

  return PluginLoggerServer;
}
