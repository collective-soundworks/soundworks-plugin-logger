import Reader from './Reader.js';
import Writer from './Writer.js';
import path from 'path';

const serverSchema = {

}

const clientSchema = {

}

let writerId = 0;

const serviceFactory = function(Service) {

  return class ServiceLogger extends Service {
    constructor(server, name, options) {
      super(server, name);

      const defaults = {
        directory: path.join(process.cwd(), '.db', 'service-logger'),
      }

      this.options = this.configure(defaults, options);
      // this.states = new Map();
      // this.server.stateManager.registerSchema(`s:${this.name}`, schema);

      this.writers = new Set();
    }

    start() {
      this.server.stateManager.observe(async (schemaName, clientId) => {
        if (schemaName === `s:${this.name}`) {
          const state = await this.server.stateManager.attach(schemaName, clientId);

          this.states.set(clientId, state);

          state.onDetach(() => {
            this.states.delete(clientId);
          });
        }
      });

      this.started();

      setTimeout(() => this.ready(), 1000);
    }

    create(name, options) {
      const dirname = path.join(this.options.directory, path.dirname(name));
      const basename = path.basename(name);
      const id = (writerId += 1);

      const writer = new Writer({ id, name, dirname, basename });
      writer.onClose = () => this.writers.delete(writer);

      this.writers.add(writer);

      return writer;
    }

    connect(client) {
      super.connect(client);

      client.socket.addListener(`s:${this.name}:create`, (name, options) => {
        const writer = this.create(name, options);

        client.socket.addListener(`s:${this.name}:${writer.id}:close`, () => {
          writer.close();
        });
      });

      client.socket.addListener(`s:${this.name}:attach`, name => {
        const writer = Array.from(this.writers).find(w => w.name === name);

        client.socket.addListener(`s:${this.name}:${writer.id}`, data => {
          data.forEach(entry => writer.write(JSON.stringify(entry)));
        });

        client.socket.addBinaryListener(`s:${this.name}:${writer.id}`, data => {
          const headerSize = 1;
          const frameSize = data[0];
          const buffer = new Array(frameSize);

          for (let i = 1; i < data.length; i += frameSize) {
            for (let j = 0; j < frameSize; j++) {
              buffer[j] = data[i + j];
            }

            writer.write(JSON.stringify(buffer));
          }
        });

        if (writer) {
          client.socket.send(`s:${this.name}:attach:${name}`, writer.id);
        } else {
          console.log(`error: writer ${name} does not exists`);
        }
      });
    }

    disconnect(client) {
      super.disconnect(client);
    }
  }
}

// not mandatory
serviceFactory.defaultName = 'logger';

export default serviceFactory;
