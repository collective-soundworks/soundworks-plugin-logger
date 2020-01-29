// from: https://github.com/hughsk/is-typedarray/blob/master/index.js
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

class Writer {
  constructor(serviceName, client, owner, name, writerId, {
    bufferSize = 1,
  } = {}) {
    this.serviceName = serviceName;
    this.client = client;
    this.owner = owner;

    this.name = name;
    this.writerId = writerId;
    this.bufferSize = bufferSize;
    this.bufferIndex = 0;
    this.binary = null;

    this._closed = false;
    this._writeChannel = `s:${this.serviceName}:${this.writerId}`;
  }

  write(data) {
    if (this._closed) {
      return;
    }

    //
    if (this.binary === null) {
      this.binary = isStrictTypedArray(data);
    }

    if (this.binary) {
      const headerSize = 1;
      const frameSize = data.length;

      if (!this.buffer) {
        this.buffer = new Float32Array(this.bufferSize * frameSize + headerSize);
        this.buffer[0] = data.length;
      }

      for (let i = 0; i < data.length; i++) {
        this.buffer[headerSize + (this.bufferIndex * frameSize + i)] = data[i];
      }
    } else {
      if (!this.buffer) {
        this.buffer = new Array(this.bufferSize);
      }

      this.buffer[this.bufferIndex] = data;
    }

    this.bufferIndex = (this.bufferIndex + 1) % this.bufferSize;

    if (this.bufferIndex === 0) {
      if (this.binary) {
        this.client.socket.sendBinary(this._writeChannel, this.buffer);
      } else {
        this.client.socket.send(this._writeChannel, this.buffer);
      }
    }
  }

  close() {
    this._closed = true;

    if (this.bufferSize > 1 && this.bufferIndex > 0) {
      // fush data in buffer
      if (this.binary) {
        const headerSize = 1;
        const frameSize = this.buffer[0];
        const maxIndex = this.bufferIndex * frameSize + headerSize; //
        const sliced = this.buffer.slice(0, maxIndex);

        // @note - we may have a concurrency here between the two sockets
        // locally with a buffer size of 200 and a big flush (198) it seems ok
        this.client.socket.sendBinary(this._writeChannel, sliced);
      } else {
        const finalData = [];

        for (let i = 0; i < this.bufferIndex; i++) {
          finalData[i] = this.buffer[i];
        }

        this.client.socket.send(this._writeChannel, finalData);
      }
    }

    // if not owner, close is a noop
    if (this.owner) {
      this.client.socket.send(`s:${this.serviceName}:${this.writerId}:close`);
    }
  }
}

const serviceFactory = function(Service) {

  return class ServiceLogger extends Service {
    constructor(client, name, options) {
      super(client, name);

      const defaults = {
        // default config options
      };

      this.options = this.configure(defaults, options);
    }

    async start() {
      this.started();
      this.ready();
    }

    async create(name, options = {}) {
      name = name + ''; // force string
      // as create is synchronous server side, we can simply do that
      this.client.socket.send(`s:${this.name}:create`, name);
      return this.attach(name, options, true);
    }

    async attach(name, options = {}, _owner = false) {
      return new Promise((resolve, reject) => {
        // const ackChannel
        this.client.socket.addListener(`s:${this.name}:attach:${name}`, writerId => {
          this.client.socket.removeAllListeners(`s:${this.name}:attach:${name}`);

          options.name = name;
          options.writerId = writerId;

          const writer = new Writer(this.name, this.client, _owner, name, writerId, options);
          resolve(writer);
        });

        this.client.socket.send(`s:${this.name}:attach`, name);
      });
    }
  }
}

// not mandatory
serviceFactory.defaultName = 'logger';

export default serviceFactory;
