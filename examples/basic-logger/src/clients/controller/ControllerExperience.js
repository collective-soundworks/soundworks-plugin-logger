import { Experience } from '@soundworks/core/client';
import { render, html } from 'lit-html';

class SoloistControllerExperience extends Experience {
  constructor(client, config, $container) {
    super(client);

    this.config = config;
    this.$container = $container;

    this.playerStates = new Map();
  }

  async start() {


    super.start();
  }

  renderApp() {
    render(html`
      <div>controller</div>
    `, this.$container);
  }
}

export default SoloistControllerExperience;
