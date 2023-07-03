import path from 'path';
import fs from 'node:fs';
import os from 'node:os';

import { isFunction, isString, isTypedArray } from '@ircam/sc-utils';

/**
 * Server-side stream writer.
 *
 * Created and retrived by the server-side `logger.createWriter(name)` method.
 */
class WriterServer {
  // @note - do not document as JSDoc, we don't want that to appear in the doc, and
  // marking as @private would make the whole class disappear from the generated doc.
  //
  // @param {SharedState} state - Shared state associated to the writer.
  // @throws {Error} Can throw when creating the directory or the file
  constructor(state, format = null) {
    this._state = state;

    // Do not document `format` for now, let's see if we really need this option...
    if (isFunction(format)) {
      this._format = format;
    } else {
      this._format = message => {
        // If binary array given convert to simple array before stringify
        if (isTypedArray(message)) {
          message = Array.from(message);
        }

        // Stringify everything that is not already a string, because:
        // ```
        // JSON.stringify('test')
        // > '"test"'
        // ```
        if (!isString(message)) {
          message = JSON.stringify(message);
        }

        return `${message}${os.EOL}`;
      };
    }

    this._stream = null;
    this._onCloseCallbacks = new Set();
    /**
     * Protected function executed at the beginning of `close()`. Declared by the
     * logger for bookkeeping.
     * @type Function
     * @private
     */
    this.beforeClose = null;
  }

  /**
   * Name of the Writer.
   * @readonly
   */
  get name() {
    return this._state.get('name');
  }

  /**
   * Pathname of the Writer.
   * @readonly
   */
  get pathname() {
    return this._state.get('pathname');
  }

  // is actually protected
  /** @private */
  async open() {
    const dirname = path.dirname(this.pathname);

    if (!fs.existsSync(dirname)) {
      try {
        await fs.promises.mkdir(dirname, { recursive: true });
      } catch(error) {
        throw new Error(`[soudworks:PluginLogger] Error while creating directory ${dirname} for writer "${this.name}": ${error.message}`);
      }
    }

    const allowReuse = this._state.get('allowReuse');
    const fileExists = fs.existsSync(this.pathname);

    if (fileExists && !allowReuse) {
      throw new Error(`[soudworks:PluginLogger] Error while creating writer "${this.name}", file already exists`);
    }

    try {
      // https://nodejs.org/api/fs.html#file-system-flags
      // - 'a': Open file for appending. The file is created if it does not exist.
      // - `w`: Open file for writing. The file is created (if it does not exist)
      //   or truncated (if it exists).
      const options = {
        flags: allowReuse ? 'a' : 'w',
        mode: '644',
        encoding : 'utf8',
      };

      // create the file before hand, mostly for testing purpose: `createWriteStream`
      // does seem to create the underlying file until some data is written, or at
      // least no synchronously...
      if (!fileExists) {
        await fs.promises.writeFile(this.pathname, '', options);
      }
      // @todo move to asynchronous API
      this._stream = fs.createWriteStream(this.pathname, options);
    } catch (error) {
      throw new Error(`[soundworks:PluginLogger] Error while creating write stream for writer "${this.name}": ${error.message}`);
    }
  }

  /**
   * Format and write data.
   * - Successive write calls are added to a new line
   * - Data can be of any type, it will be stringified before write.
   * - TypedArrays are converted to Array before being stringified.
   * @param {Any} data - Data to be written
   */
  write(data) {
    if (this._stream.writable) {
      this._stream.write(this._format(data));
    }
  }

  /**
   * Close the stream,
   * @returns {Promise} Promise that resolves when the stream is closed
   */
  async close() {
    // clean state and everything before actually closing the stream
    await this.beforeClose();
    // if the writer has been created by the server, delete the state
    if (this._state.isOwner) {
      await this._state.delete();
    }

    return new Promise((resolve, reject) => {
      // wait for the stream close event
      this._stream.on('close', async () => {
        for (let callback of this._onCloseCallbacks) {
          await callback();
        }

        resolve();
      });

      this._stream.end();
    });
  }

  /**
   * Register a function to be executed when the Writer is closed. The function
   * will be executed when the underlying stream is closed and before the `close()`
   * Promise is resolved.
   * @param {Function} callback - Function to execute on close.
   * @returns Function that unregister the listener when executed.
   */
  onClose(callback) {
    this._onCloseCallbacks.add(callback);
    return () => this._onCloseCallbacks.delete(callback);
  }
}

export default WriterServer;
