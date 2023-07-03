import { isTypedArray } from '@ircam/sc-utils';

/**
 * Client-side stream writer.
 *
 * Created and retrived by the client-side `logger.createWriter(name, bufferSize)` and
 * `logger.attachWriter(name, bufferSize)` methods.
 */
class WriterClient {
  constructor(state, bufferSize = 1) {
    this._state = state;
    this._bufferSize = bufferSize;
    this._bufferIndex = 0;
    this._buffer = new Array(this._bufferSize);
    this._closed = false;
    this._onPacketSendListeners = new Set();
  }

  get name() {
    return this._state.get('name');
  }

  get pathname() {
    return this._state.get('pathname');
  }

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
      // @todo - this is silly, just send a raw message
      this._state.set({ data: this._buffer });
      this._onPacketSendListeners.forEach(callback => callback());
    }
  }

  async close() {
    this._closed = true;

    // flush remaining buffered data
    if (this._bufferSize > 1 && this._bufferIndex > 0) {
      this._buffer.splice(this._bufferIndex);
      // @todo - this is silly, just send a raw message
      await this._state.set({ data: this._buffer });

      this._onPacketSendListeners.forEach(callback => callback());
    }

    if (this._state.isOwner) {
      await this._state.delete();
    } else {
      await this._state.detach();
    }
  }

  onPacketSend(callback) {
    this._onPacketSendListeners.add(callback);
    return () => this._onPacketSendListeners.delete(callback);
  }
}

export default WriterClient;

