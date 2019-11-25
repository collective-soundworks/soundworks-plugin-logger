import { Experience } from '@soundworks/core/client';
import { render, html } from 'lit-html';
import renderAppInitialization from '../views/renderAppInitialization';

class PlayerExperience extends Experience {
  constructor(client, config = {}, $container) {
    super(client);

    this.config = config;
    this.$container = $container;

    // require services
    this.logger = this.require('logger');

    // default initialization views
    renderAppInitialization(client, config, $container);
  }

  async start() {
    super.start();

    // test attaching to an existing logger (e.g. some metas / shared data)
    // --------------------------------------------------------------------
    const metasLogger = await this.logger.attach('subfolder/metas');

    setInterval(() => {
      metasLogger.write(`message from ${this.client.id}`);
    }, 1000);

    // test normal logger created by client
    // --------------------------------------------------------------------
    // const playerLogger = await this.logger.create(`clients/player-${this.client.id}`);

    // setInterval(() => {
    //   playerLogger.write('youyoyuoyuy ' + Math.random());
    // }, 1000);

    // setTimeout(() => {
    //   playerLogger.write('closing...');
    //   playerLogger.close();
    // }, 4 * 1000);

    // test binary logger with buffer size
    // --------------------------------------------------------------------
    const binaryLogger = await this.logger.create(`clients/binary-${this.client.id}`, {
      bufferSize: 200,
    });

    let index = 0;
    const maxIndex = 598;

    const id = setInterval(() => {
      const buffer = new Float32Array(6);
      const value = index += 1;

      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = value;
      }

      binaryLogger.write(buffer);

      if (index === maxIndex) {
        clearInterval(id);
        binaryLogger.close();
      }
    }, 20);

    this.renderApp();
  }

  renderApp() {
    render(html`
      <div class="screen">
        <section class="half-screen aligner">
          <h1 class="title">Hello ${this.client.id}</h1>
        </section>
        <section class="half-screen aligner"></section>
      </div>
    `, this.$container);
  }
}

export default PlayerExperience;
