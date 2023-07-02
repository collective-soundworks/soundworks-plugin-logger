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


    if (fs.existsSync(this.pathname)) {
      throw new Error(`[soudworks:PluginLogger] Error while creating writer "${this.name}", file already exists`);
    } else {
      await fs.promises.writeFile(this.pathname, '');
    }

    // create stream source
    try {
      // use synchronous API for nows
      // @todo move to asynchronous
      this._stream = fs.createWriteStream(this.pathname);
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
    await this.onClose();

    return new Promise((resolve, reject) => {
      this._stream.on('close', () => {
        resolve();
      });

      this._stream.end();
    });
  }
}

export default WriterServer;