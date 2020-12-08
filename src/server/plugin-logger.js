import Reader from './Reader.js';
import Writer from './Writer.js';
import path from 'path';
import fs from 'fs';
import mkdirp from 'mkdirp';

let writerId = 0;

const pluginFactory = function(AbstractPlugin) {

  return class PluginLogger extends AbstractPlugin {
    constructor(server, name, options) {
      super(server, name);

      const defaults = {
        directory: path.join(process.cwd(), '.db', this.name),
      };

      this.options = this.configure(defaults, options);

      if (!fs.existsSync(this.options.directory)) {
        try {
          mkdirp.sync(this.options.directory);
        } catch(error) {
          console.error(`Error while creating directory ${this.options.directory}: ${error.message}`);
          throw error;
        }
      }

      this.writers = new Set();
    }

    start() {
      this.started();

      setTimeout(() => this.ready(), 1000);
    }

    async create(name, options) {
      name = name + '';
      const dirname = path.join(this.options.directory, path.dirname(name));
      const basename = path.basename(name);
      const id = (writerId += 1);

      const writer = new Writer({ id, name, dirname, basename });
      writer.onClose = () => this.writers.delete(writer)
      this.writers.add(writer);

      return writer;
    }

    connect(client) {
      super.connect(client);

      client.socket.addListener(`s:${this.name}:create`, async (name, options) => {
        const writer = await this.create(name, options);

        client.socket.addListener(`s:${this.name}:${writer.id}:close`, () => {
          client.socket.removeAllListeners(`s:${this.name}:${writer.id}:close`);

          // @todo - we should send an aknoledgement on close so that
          // `await write.close` is really true
          writer.close();
        });

        client.socket.send(`s:${this.name}:create:${name}`);
      });

      client.socket.addListener(`s:${this.name}:attach`, name => {
        const writer = Array.from(this.writers).find(w => w.name === name);

        if (writer) {
          // clean listeners on detach
          client.socket.addListener(`s:${this.name}:${writer.id}:detach`, () => {
            client.socket.removeAllListeners(`s:${this.name}:${writer.id}:detach`);
            client.socket.removeAllListeners(`s:${this.name}:${writer.id}`);
            client.socket.removeAllBinaryListeners(`s:${this.name}:${writer.id}`);
          });

          client.socket.addListener(`s:${this.name}:${writer.id}`, data => {
            data.forEach(entry => writer.write(entry));
          });

          client.socket.addBinaryListener(`s:${this.name}:${writer.id}`, data => {
            // @note - we need to unpack the buffered data before writing
            const headerSize = 1;
            const frameSize = data[0];
            const buffer = new Array(frameSize);

            for (let i = 1; i < data.length; i += frameSize) {
              for (let j = 0; j < frameSize; j++) {
                buffer[j] = data[i + j];
              }

              writer.write(buffer);
            }
          });

          client.socket.send(`s:${this.name}:attach:${name}`, writer.id);
        } else {
          console.log(`[logger error] writer ${name} does not exists`);
          client.socket.send(`s:${this.name}:attach-error:${name}`);
        }
      });
    }

    disconnect(client) {
      super.disconnect(client);
    }
  }
}

export default pluginFactory;
