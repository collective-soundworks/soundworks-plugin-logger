import { isTypedArray } from '@ircam/sc-utils';

/**
 * Client-side stream writer.
 *
 * Created and retrieved by the client-side `logger.createWriter(name, bufferSize)` and
 * `logger.attachWriter(name, bufferSize)` methods.
 */
export default class ClientWriter {
  #plugin = null;
  #state = null;
  #bufferSize = null;
  #buffer = null;
  #sendChannel = null;
  #bufferIndex = 0;
  #onPacketSendCallbacks = new Set();
  #onCloseCallbacks = new Set();
  #closed = false;
  /** hideconstructor */
  constructor(plugin, state, bufferSize = 1) {
    this.#plugin = plugin;
    this.#state = state;
    this.#bufferSize = bufferSize;
    this.#buffer = new Array(this.#bufferSize);
    this.#sendChannel = `sw:plugin:${this.#plugin.id}:data`;

    // if the server close a shared stream, close won't be called
    this.#state.onDetach(async () => {
      // we do not flush, as there could concurrency issues, i.e. sending data
      // to a stream that is already closed server-side
      this.#closed = true;

      for (let callback of this.#onCloseCallbacks) {
        await callback();
      }
    });
  }

  /**
   * Name of the Writer.
   * @readonly
   */
  get name() {
    return this.#state.get('name');
  }

  /**
   * Pathname of the Writer.
   * @readonly
   */
  get pathname() {
    return this.#state.get('pathname');
  }

  /**
   * Format and write data.
   * - Successive write calls are added to a new line
   * - Data can be of any type, it will be stringified before write.
   * - TypedArrays are converted to Array before being stringified.
   * @param {Any} data - Data to be written
   */
  write(data) {
    // avoid concurrency / write after end issues
    if (this.#closed) {
      return;
    }

    if (isTypedArray(data)) {
      data = Array.from(data);
    }

    this.#buffer[this.#bufferIndex] = data;
    this.#bufferIndex = (this.#bufferIndex + 1) % this.#bufferSize;

    if (this.#bufferIndex === 0) {
      // buffer is full, send data
      const msg = { pathname: this.pathname, data: this.#buffer };
      this.#plugin.client.socket.send(this.#sendChannel, msg);

      this.#onPacketSendCallbacks.forEach(callback => callback());
    }
  }

  /**
   * Flush the buffer, only applies if `bufferSize` option is set.
   */
  flush() {
    // flush remaining buffered data
    if (this.#bufferSize > 1 && this.#bufferIndex > 0) {
      const copy = new Array(this.bufferSize);

      for (let i = 0; i < this.#bufferIndex; i++) {
        copy[i] = this.#buffer[i];
      }

      this.#bufferIndex = 0; // reset buffer index

      const msg = { pathname: this.pathname, data: copy };
      this.#plugin.client.socket.send(this.#sendChannel, msg);

      this.#onPacketSendCallbacks.forEach(callback => callback());
    }
  }

  /**
   * Close the writer.
   * @returns {Promise} Promise that resolves when the stream is closed
   */
  async close() {
    this.#closed = true;

    this.flush();

    if (this.#state.isOwner) {
      await this.#state.delete();
    } else {
      await this.#state.detach();
    }
  }

  /**
   * Register a function to be executed when a packet is sent on the network.,
   * i.e. when the buffer is full or flushed on close.
   * @param {Function} callback - Function to execute on close.
   * @returns {Function} that unregister the listener when executed.
   */
  onPacketSend(callback) {
    this.#onPacketSendCallbacks.add(callback);
    return () => this.#onPacketSendCallbacks.delete(callback);
  }

  /**
   * Register a function to be executed when the Writer is closed. The function
   * will be executed after the buffer has been flushed and underlying state has
   * been deleted, and before the `close` Promise resolves.
   * @param {Function} callback - Function to execute on close.
   * @returns {Function} that unregister the listener when executed.
   */
  onClose(callback) {
    this.#onCloseCallbacks.add(callback);
    return () => this.#onCloseCallbacks.delete(callback);
  }
}
