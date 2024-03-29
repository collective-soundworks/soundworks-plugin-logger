import { isTypedArray } from '@ircam/sc-utils';

/**
 * Client-side stream writer.
 *
 * Created and retrived by the client-side `logger.createWriter(name, bufferSize)` and
 * `logger.attachWriter(name, bufferSize)` methods.
 */
class WriterClient {
  constructor(plugin, state, bufferSize = 1) {
    this._plugin = plugin;
    this._state = state;
    this._bufferSize = bufferSize;
    this._bufferIndex = 0;
    this._buffer = new Array(this._bufferSize);
    this._onPacketSendCallbacks = new Set();
    this._onCloseCallbacks = new Set();

    this._closed = false;
    this._sendChannel = `sw:plugin:${this._plugin.id}:data`;

    // if the server close a shared stream, close won't be called
    this._state.onDetach(async () => {
      // we do not flush, as there could concurrency issues, i.e. sending data
      // to a stream that is already closed server-side
      this._closed = true;

      for (let callback of this._onCloseCallbacks) {
        await callback();
      }
    });
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

  /**
   * Format and write data.
   * - Successive write calls are added to a new line
   * - Data can be of any type, it will be stringified before write.
   * - TypedArrays are converted to Array before being stringified.
   * @param {Any} data - Data to be written
   */
  write(data) {
    // avoid concurrency / write after end issues
    if (this._closed) {
      return;
    }

    if (isTypedArray(data)) {
      data = Array.from(data);
    }

    this._buffer[this._bufferIndex] = data;
    this._bufferIndex = (this._bufferIndex + 1) % this._bufferSize;

    if (this._bufferIndex === 0) {
      // buffer is full, send data
      const msg = { pathname: this.pathname, data: this._buffer };
      this._plugin.client.socket.send(this._sendChannel, msg);

      this._onPacketSendCallbacks.forEach(callback => callback());
    }
  }

  /**
   * Flush the buffer, only applies if `bufferSize` option is set.
   */
  flush() {
    // flush remaining buffered data
    if (this._bufferSize > 1 && this._bufferIndex > 0) {
      const copy = new Array(this.bufferSize);

      for (let i = 0; i < this._bufferIndex; i++) {
        copy[i] = this._buffer[i];
      }

      this._bufferIndex = 0; // reset buffer index

      const msg = { pathname: this.pathname, data: copy };
      this._plugin.client.socket.send(this._sendChannel, msg);

      this._onPacketSendCallbacks.forEach(callback => callback());
    }
  }

  /**
   * Close the writer.
   * @returns {Promise} Promise that resolves when the stream is closed
   */
  async close() {
    this._closed = true;

    this.flush();

    if (this._state.isOwner) {
      await this._state.delete();
    } else {
      await this._state.detach();
    }
  }

  /**
   * Register a function to be executed when a packet is sent on the network.,
   * i.e. when the buffer is full or flushed on close.
   * @param {Function} callback - Function to execute on close.
   * @returns Function that unregister the listener when executed.
   */
  onPacketSend(callback) {
    this._onPacketSendCallbacks.add(callback);
    return () => this._onPacketSendCallbacks.delete(callback);
  }

  /**
   * Register a function to be executed when the Writer is closed. The function
   * will be executed after the buffer has been flushed and underlying state has
   * been deleted, and before the `close` Promise resolves.
   * @param {Function} callback - Function to execute on close.
   * @returns Function that unregister the listener when executed.
   */
  onClose(callback) {
    this._onCloseCallbacks.add(callback);
    return () => this._onCloseCallbacks.delete(callback);
  }
}

export default WriterClient;

