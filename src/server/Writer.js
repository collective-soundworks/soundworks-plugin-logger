import path from 'path';
import fs from 'fs';
import os from 'os';
import mkdirp from 'mkdirp';

/**
 * Pad a string with a prefix.
 *
 * @param {String} prefix
 * @param {String} radical
 * @returns {String} concatenation of prefix + radical, sliced to the minimum of
 *                   the prefix or radical size.
 */
export function pad(prefix, radical) {
  const string = typeof radical === 'string' ? radical : radical.toString();
  const slice = string.length > prefix.length ? prefix.length : -prefix.length;

  return (prefix + string).slice(slice);
}

/**
 * Returns a date suitable for a file name.
 *
 * @returns {String} date as YYYYMMDD_hhmmss
 */
export function date() {
  const date = new Date();

  const year = date.getFullYear();
  const month = pad('00', date.getMonth() + 1); // Month starts at 0
  const day = pad('00', date.getDate());

  const hours = pad('00', date.getHours());
  const minutes = pad('00', date.getMinutes());
  const seconds = pad('00', date.getSeconds());
  const millisec = pad('000', date.getMilliseconds());

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function isStrictTypedArray(arr) {
  return (
       arr instanceof Int8Array
    || arr instanceof Int16Array
    || arr instanceof Int32Array
    || arr instanceof Uint8Array
    || arr instanceof Uint8ClampedArray
    || arr instanceof Uint16Array
    || arr instanceof Uint32Array
    || arr instanceof Float32Array
    || arr instanceof Float64Array
  )
}


/**
 * Simple stream writer.
 */
class Writer {
  /**
   * @callback Writer~format
   * @param {Object} message
   * @returns {String} it must be a string.
   */

  /**
   * Constructor, that may serve as a copy constructor.
   * To create linked streams, use {@link Writer#createSub}.
   *
   * @param {Object} options that must at least contain
   * @param {String} options.id
   * @param {String} options.name
   * @param {String} options.dirname
   * @param {String} options.basename
   * @param {Writer~format} options.format defaults to converting to string and
   *                        appending a line break
   * @throws {Error} on creating directory or file
   */
  constructor(options) {
    // mandatory
    this.id = options.id;
    this.name = options.name;
    this.basename = options.basename;
    this.dirname = path.join(path.resolve(options.dirname));

    // options
    this.format = typeof options.format === 'function' ?
      options.format : message => {
        // if binary array given convert to array before stringify
        if (isStrictTypedArray(message)) {
          const arr = [];
          for (let i = 0; i < message.length; i++) {
            arr[i] = message[i];
          }
          message = arr;
        }

        // stringify everything that is not already a string
        if (typeof message !== 'string') {
          message = JSON.stringify(message);
        }

        return `${message}${os.EOL}`;
      };

    if (!fs.existsSync(this.dirname)) {
      try {
        mkdirp.sync(this.dirname);
      } catch(error) {
        console.error(`Error while creating directory ${this.dirname}: ${error.message}`);
        throw error;
      }
    }

    this.path = path.join(this.dirname, `${date()}-${this.basename}`);

    try {
      this.stream = fs.createWriteStream(this.path);
    } catch (error) {
      console.error(`Error while creating write stream for ${this.path}: ${error.message}`);
    }
  }

  /**
   * Format and write message.
   *
   * @param {String} message
   * @returns {Object} this
   */
  write(message) {
    this.stream.write(this.format(message));
  }

  /**
   * Close the stream,
   * // as well as any other created with {@link Writer#createSub}.
   *
   * @returns {Object} this
   */
  async close() {
    return new Promise((resolve, reject) => {
      this.stream.on('close', () => {
        this.onClose();
        resolve();
      });

      this.stream.end();
    });
  }

  /**
   * @private
   *
   * (remove this for now) - keep it dead simple
   *
   * Create a new stream with the same options, but possible override.
   * 'name' or 'dirname' must be different or it will refer to the same file.
   *
   * The newly created stream will close when this parent closes.
   *
   * @param {Object} options
   * @returns {Logger}
   */
  // createSub(options = {}) {
  //   const subOptions = Object.assign({}, this, options);
  //   return new Writer(subOptions);
  // }
}

export default Writer;
