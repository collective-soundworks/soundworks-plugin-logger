# `@soundworks/plugin-logger`

> [`soundworks`](https://github.com/collective-soundworks/soundworks) plugin dedicated to recording arbitrary from any node of the network into plain old files.

## Table of Contents

<!-- toc -->

- [Installation](#installation)
- [Example](#example)
- [Usage](#usage)
  * [Server installation](#server-installation)
    + [Registering the plugin](#registering-the-plugin)
    + [Requiring the plugin](#requiring-the-plugin)
  * [Client installation](#client-installation)
    + [Registering the plugin](#registering-the-plugin-1)
    + [Requiring the plugin](#requiring-the-plugin-1)
  * [Creating writers and log data](#creating-writers-and-log-data)
  * [Share a writer between several clients](#share-a-writer-between-several-clients)
  * [Buffering data to prevent network congestion](#buffering-data-to-prevent-network-congestion)
- [Credits](#credits)
- [License](#license)

<!-- tocstop -->

## Installation

```sh
npm install @soundworks/plugin-logger --save
```

## Example

A working example can be found in the [https://github.com/collective-soundworks/soundworks-examples](https://github.com/collective-soundworks/soundworks-examples) repository.

## Usage

### Server installation

#### Registering the plugin

```js
// index.js
import { Server } from '@soundworks/core/server';
import pluginLoggerFactory from '@soundworks/plugin-logger/server';

const server = new Server();
server.pluginManager.register('logger', pluginLoggerFactory, {
  // define directory in which the files will be written
  // (defaults to `.data/${plugin.name}`)
  directory: 'logs',
}, []);
```

#### Requiring the plugin

```js
// MyExperience.js
import { AbstractExperience } from '@soundworks/core/server';

class MyExperience extends AbstractExperience {
  constructor(server, clientType) {
    super(server, clientType);
    // require plugin in the experience
    this.logger = this.require('logger');
  }
}
```

### Client installation

#### Registering the plugin

```js
// index.js
import { Client } from '@soundworks/core/client';
import pluginLoggerFactory from '@soundworks/plugin-logger/client';

client.pluginManager.register('logger', pluginLoggerFactory, {}, []);
```

#### Requiring the plugin

```js
// MyExperience.js
import { AbstractExperience } from '@soundworks/core/client';

class MyExperience extends AbstractExperience {
  constructor(client) {
    super(client);
    // require plugin in the experience
    this.logger = this.require('logger');
  }
}
```

### Creating writers and log data

Creating writers can be implemented similarly server-side and client-side.

```js
// 1. create a writer
// the filename will be automatically prefix with the date and time,
// following the format: `yyyymmdd-hhmmss-${filename}
// note: in distributed applications, be careful of defining a unique
// filename per client to avoid collisions, for example using `client.id`
// in the filename.
const filename = `${this.client.id}-log-file.csv`;
const writer = await this.logger.create(filename);
// 2. writing data into file,
// create arbitrary data, the formatting of the data is left to the user
for (let i = 0; i < 10; i++) {
  let line = '';
  for (let j = 0; j < 5; j++) {
    line += `${i + j};`
  }

  writer.write(line); // be aware that these operations are asynchronous
}
// 3. close the writer when done
writer.close(); // be aware that these operations are asynchronous
// async writer.close(); can be done server-side for testing purpose

// the file `logs/yyyymmdd-hhmmss-${filename}` should now contain
// 0;1;2;3;4;
// 1;2;3;4;5;
// 2;3;4;5;6;
// 3;4;5;6;7;
// 4;5;6;7;8;
// 5;6;7;8;9;
// 6;7;8;9;10;
// 7;8;9;10;11;
// 8;9;10;11;12;
// 9;10;11;12;13;
```

### Share a writer between several clients

Create a writer server-side

```js
// server-side
const sharedWriter = await this.logger.create('shared-writer');
```

Attach to the writer and data from this client side

```js
const sharedWriter = await this.logger.attach('shared-writer');
sharedWriter.write(`client ${this.client.id} wrote something`);
// later... close connection, the writer stays open for other
// connections until it's closed by the server
sharedWriter.close();
```

### Buffering data to prevent network congestion

When logging data at from a source with rapid frame rate (e.g. motion sensors), you may want to buffer the data client-side and batch the sends to the server to avoid network congestion.

This can be achieved by defining the `bufferSize` when creating the writer. This option is meant at minimizing network communications and is thus only available client-side.

```js
const bufferFilename = `client-${this.client.id}-buffering`;
const bufferingWriter = await this.logger.create(bufferFilename, {
  // send data to the server when 20 lines have been buffered
  bufferSize: 20,
});

let line = 0;
const intervalId = setInterval(() => {
  // write by batch of 25 lines so that we can see the buffering process
  // on the number of lines that are written on the file
  for (let i = 0; i < 25; i++) {
    line += 1;

    // binary arrays are also supported and are send to
    // the server using the binary socket connection
    const data = new Uint8Array(2);
    data[0] = line;
    data[1] = i;

    bufferingWriter.write(data);

    if (line === 123) {
      clearInterval(intervalId);
      // when closing the connexion, the buffer is automatically
      // flushed before actually closing the writer.
      bufferingWriter.close();
    }
  }
}, 1000);
```

## Credits

The code has been initiated in the framework of the WAVE and CoSiMa research projects, funded by the French National Research Agency (ANR).

## License

BSD-3-Clause
