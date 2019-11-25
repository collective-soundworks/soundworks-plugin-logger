import { Experience } from '@soundworks/core/server';

class PlayerExperience extends Experience {
  constructor(server, clientTypes, options = {}) {
    super(server, clientTypes);

    this.logger = this.require('logger');
    // console.log(this.logger);
  }

  start() {
    super.start();

    // const logger = this.logger.create('server-test');
    // let index = 0;
    // setInterval(() => {
    //   logger.write('test-' + index++);
    // }, 1000);
  }

  enter(client) {
    super.enter(client);
  }

  exit(client) {
    super.exit(client);
  }
}

export default PlayerExperience;
