import path from 'path';
import fs from 'fs';
import readLine from 'readline';

class Reader {
  /**
   * @callback Reader~parse
   * @param {String} line to parse
   * @returns {Object} As you like
   */

  /**
   * Constructor, mainly used to define the parse function.
   * May then read several files.
   *
   * @see {@link Reader#read}
   *
   * @param {Objet} options
   * @param {Reader~parse} options.parse undefined is fine
   */
  constructor(options = {}) {
    this.parse = options.parse;
  }

  /**
   * Read a file as a stream, apply `readCallback` on each element returned by
   * the `parse` function defined in the constructor, and filly call
   * `endCallback`.
   *
   * @param {Object} options
   * @param {String} options.streamPath this is mandatory
   * @param {Function} options.readCallback on each element returned by `parse`
   * @param {Function} options.endCallback after every elements
   * @param {Function} options.errorCallback on error during opening and
   *                   reading. Define to avoid throwing errors.
   * @throws {Error} On file opening and reading errors, when no `errorCallback
   *                 is defined`.
   */
  read(options) {
    // mandatory
    const streamPath = options.streamPath;

    // options
    const readCallback = options.readCallback;
    const endCallback = options.endCallback;
    const errorCallback = options.errorCallback;

    try {
      const stream = fs.createReadStream(streamPath);
      stream.on('error', (error) => {
        if (errorCallback) {
          errorCallback(error);
        } else {
          console.error(`Error with ${streamPath}: ${error.message}`);
          throw error;
        }
      });

      const lineReader = readLine.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      lineReader.on('error', (error) => {
        // always define register 'onerror' to avoid throwing error
        if (errorCallback) {
          errorCallback(error);
        }
      });

      if (endCallback) {
        lineReader.on('close', () => {
          endCallback();
        });
      }

      if (readCallback) {
        lineReader.on('line', (line) => {
          if (line.length > 0) {
            if (this.parse) {
              readCallback(this.parse(line));
            } else {
              readCallback(line);
            }
          }
        });
      }

    } catch (error) {
      if (errorCallback) {
        errorCallback(error);
      } else {
        console.error(`Error while reading stream at ${streamPath}: ${error.message}`);
        throw error;
      }
    }

  }

}

export default Reader;
