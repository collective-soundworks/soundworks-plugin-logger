import path from 'path';
import fs from 'node:fs';
import os from 'node:os';

import { isFunction, isString, isTypedArray } from '@ircam/sc-utils';

export const kWriterBeforeCloseCallback = Symbol('plugin:logger:server-writer:before-close-callback');
export const kWriterStream = Symbol('plugin:logger:server-writer:stream');
export const kWriterState = Symbol('plugin:logger:server-writer:state');

/**
 * Server-side stream writer.
 *
 * Created and retrieved by the server-side `logger.createWriter(name)` method.
 */
export default class ServerWriter {
  #format = null;
  #onCloseCallbacks = new Set();

  /** hideconstructor */
  constructor(state, format = null) {
    this[kWriterState] = state;

    /**
     * Protected function executed at the beginning of `close()`. Declared by the
     * logger for bookkeeping.
     * @type Function
     * @private
     */
    this[kWriterBeforeCloseCallback] = null;
    // protected for testing
    this[kWriterStream] = null;

    // Do not document `format` for now, let's see if we really need this option...
    if (isFunction(format)) {
      this.#format = format;
    } else {
      this.#format = message => {
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
  }

  /**
   * Name of the Writer.
   * @readonly
   */
  get name() {
    return this[kWriterState].get('name');
  }

  /**
   * Pathname of the Writer.
   * @readonly
   */
  get pathname() {
    return this[kWriterState].get('pathname');
  }

  // is actually protected
  /** @private */
  async open() {
    const dirname = path.dirname(this.pathname);

    if (!fs.existsSync(dirname)) {
      try {
        await fs.promises.mkdir(dirname, { recursive: true });
      } catch (error) {
        throw new Error(`Cannot execute 'open' on ServerWriter: Error while creating directory '${dirname}' for writer '${this.name}': ${error.message}`);
      }
    }

    const allowReuse = this[kWriterState].get('allowReuse');
    const fileExists = fs.existsSync(this.pathname);

    if (fileExists && !allowReuse) {
      throw new Error(`Cannot execute 'open' on ServerWriter: Error while creating writer '${this.name}', file already exists`);
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
      this[kWriterStream] = fs.createWriteStream(this.pathname, options);
    } catch (error) {
      throw new Error(`Cannot execute 'open' on ServerWriter: Error while creating write stream for writer '${this.name}': ${error.message}`);
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
    if (this[kWriterStream].writable) {
      this[kWriterStream].write(this.#format(data));
    }
  }

  /**
   * Close the writer and the underlying stream.
   * @returns {Promise} Promise that resolves when the stream is closed
   */
  async close() {
    // clean maps before actually closing the stream
    await this[kWriterBeforeCloseCallback]();
    // if the writer has been created by the server, delete the state
    if (this[kWriterState].isOwner) {
      await this[kWriterState].delete();
    }

    return new Promise((resolve, _) => {
      // wait for the stream close event
      this[kWriterStream].on('close', async () => {
        for (let callback of this.#onCloseCallbacks) {
          await callback();
        }

        resolve();
      });

      this[kWriterStream].end();
    });
  }

  /**
   * Register a function to be executed when the Writer is closed. The function
   * will be executed when the underlying stream is closed and before the `close()`
   * Promise is resolved.
   * @param {Function} callback - Function to execute on close.
   * @returns {Function} that unregister the listener when executed.
   */
  onClose(callback) {
    this.#onCloseCallbacks.add(callback);
    return () => this.#onCloseCallbacks.delete(callback);
  }
}
