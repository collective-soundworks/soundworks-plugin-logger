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
- [Todos](#todos)
- [Credits](#credits)
- [License](#license)

<!-- tocstop -->

## Installation

```sh
npm install @soundworks/plugin-logger --save
```

## Usage

### Server

```js
// index.js
import { Server } from '@soundworks/core/server.js';
import pluginLogger from '@soundworks/plugin-logger/server.js';

const server = new Server(config);
server.pluginManager.register('logger', pluginLogger, {
  // define directory in which the files will be written, 
  // defaults to `null`, i.e. kind of "idle" plugin state
  dirname: 'logs',
});

await server.start();
// create a logger
const logger = await server.pluginManager.get('logger');
const writer = await logger.createWriter('my-server-log');
writer.write('hello server');
```

### Client

```js
// index.js
import { Client } from '@soundworks/core/client.js';
import pluginLogger from '@soundworks/plugin-logger/client.js';

const client = new Client(config);
client.pluginManager.register('logger', pluginLogger);

await client.start();
// create a logger
const logger = await client.pluginManager.get('logger');
const writer = await logger.createWriter('my-client-log');
writer.write('hello client');
```

## Notes & Receipes

_In the following examples, we assume the server-side logger as been configured to use the `logs` directory._

### Default extension

If a writer is created with no extesion in its name, the `.txt` extention is added by default, otherwise the given extension is kept intact:

```js
const writer = await logger.createWriter('first-log.txt');
console.log(writer.pathname);
> 'logs/2023.07.3_16.39.43_0001_first-log.txt';

const writer = await logger.createWriter('second-log.md');
console.log(writer.pathname);
> 'logs/2023.07.3_16.39.43_0002_second-log.txt';
```

### Prefix in log files

By default all log files (client-side and server-side) are prefixed following a format: `yyyy.mm.dd_hh.mm.ss_id_${basename}`. This behavior can be turned of
by seeting the `uesPrefix` option to false when creating a writer.

With `usePrefix = true` (default):

```js
const writer = await logger.createWriter('my-log.txt');
console.log(writer.pathname);
> 'logs/2023.07.3_16.39.43_0001_my-log.txt';
``` 

With `usePrefix = false`:

```js
const writer = await logger.createWriter('my-log.txt');
console.log(writer.pathname);
> 'logs/my-log.txt';
``` 

While usefull in some situations, this option can lead to errors if two writers are created with the same name.

### Creating log files in sub-directories

If a path is given in the name, e.g. `my-dir/my-log`, sub-directories will be automatically created:

```js
const writer = await logger.createWriter(`my-dir/my-log`);
console.log(writer.pathname);
> 'logs/my-dir/my-log.txt';
``` 

### Share a writer between several clients

In a similar way as the shared state (while most simple), clients can attach to a writer created by the server. This can be used for example to create global logs informations where all clients contribute. Create a writer server as usual:

```js
// server-side
const sharedWrite = await logger.createWriter('shared-writer');
```

Attach to the writer on the client-size, note the `attachWriter` method:

```js
// client-side
const sharedWriter = await logger.attachWriter('shared-writer');
```

All writers created by the server can be attached by clients.

### Client-side buffering

In many cases you may want to buffer the data client-side and batch the sends to the server to avoid network congestion. This can be done on writers created or attach by the client by defining the `bufferSize` option.

```js
// client-side
const myWriter = await logger.createWriter('buffered-writer', { bufferSize: 10 });
// data is buffered on the client side
myWriter.write('1');
myWriter.write('2');
// ...
myWriter.write('10');
// data is sent to the server
```

## API

<!-- api -->

### Classes

<dl>
<dt><a href="#PluginLoggerClient">PluginLoggerClient</a></dt>
<dd><p>Client-side representation of the soundworks sync plugin.</p>
</dd>
<dt><a href="#PluginLoggerServer">PluginLoggerServer</a></dt>
<dd><p>Server-side representation of the soundworks logger plugin.</p>
</dd>
<dt><a href="#WriterClient">WriterClient</a></dt>
<dd><p>Client-side stream writer.</p>
<p>Created and retrived by the client-side <code>logger.createWriter(name, bufferSize)</code> and
<code>logger.attachWriter(name, bufferSize)</code> methods.</p>
</dd>
<dt><a href="#WriterServer">WriterServer</a></dt>
<dd><p>Server-side stream writer.</p>
<p>Created and retrived by the server-side <code>logger.createWriter(name)</code> method.</p>
</dd>
</dl>

<a name="PluginLoggerClient"></a>

### PluginLoggerClient
Client-side representation of the soundworks sync plugin.

**Kind**: global class  

* [PluginLoggerClient](#PluginLoggerClient)
    * [new PluginLoggerClient()](#new_PluginLoggerClient_new)
    * [.createWriter(name, options)](#PluginLoggerClient+createWriter)
    * [.attachWriter(name, options)](#PluginLoggerClient+attachWriter)

<a name="new_PluginLoggerClient_new"></a>

#### new PluginLoggerClient()
The constructor should never be called manually. The plugin will be
instantiated by soundworks when registered in the `pluginManager`

**Example**  
```js
client.pluginManager.register('logger', pluginLogger);
```
<a name="PluginLoggerClient+createWriter"></a>

#### pluginLoggerClient.createWriter(name, options)
Create a writer.

**Kind**: instance method of [<code>PluginLoggerClient</code>](#PluginLoggerClient)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>String</code> |  | Name of the writer. Used to generate the log file  pathname. |
| options | <code>Object</code> |  | Options for the writer. |
| [options.bufferSize] | <code>Number</code> | <code>1</code> | Number of writes buffered before  sending the logs to the server. |
| [options.usePrefix] | <code>Boolean</code> | <code>true</code> | Whether the writer file should  be prefixed with a `YYYY.MM.DD_hh.mm.ss_uid_` string. |
| [options.allowReuse] | <code>Boolean</code> | <code>false</code> | If `usePrefix` is false, allow  to reuse an existing underlying file for the writer. New data will be  appended to the file.  Can be usefull to log global informations in the same file amongst different  sessions. |

<a name="PluginLoggerClient+attachWriter"></a>

#### pluginLoggerClient.attachWriter(name, options)
Attach to a shared writer created by the server. Can be usefull to create
files that gather informations from multiple nodes.

**Kind**: instance method of [<code>PluginLoggerClient</code>](#PluginLoggerClient)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>String</code> |  | Name of the writer. Used to generate the log file  pathname. |
| options | <code>Object</code> |  | Options for the writer. |
| [options.bufferSize] | <code>Number</code> | <code>1</code> | Number of writes buffered before  sending the logs to the server. |

<a name="PluginLoggerServer"></a>

### PluginLoggerServer
Server-side representation of the soundworks logger plugin.

**Kind**: global class  

* [PluginLoggerServer](#PluginLoggerServer)
    * [new PluginLoggerServer()](#new_PluginLoggerServer_new)
    * [.switch(dirname)](#PluginLoggerServer+switch)
    * [.createWriter(name, options)](#PluginLoggerServer+createWriter)

<a name="new_PluginLoggerServer_new"></a>

#### new PluginLoggerServer()
The constructor should never be called manually. The plugin will be
instantiated by soundworks when registered in the `pluginManager`

Available options:
- `[dirname=null]` {String} - The directory in which the log files should
 be created. If `null` the plugin is in some "idle" state, and any call
 to `createWriter` (or client-side `attachWriter`) will throw an error.
 The directory can be changed at runtime usin the `switch` method.

**Example**  
```js
server.pluginManager.register('logger', pluginLogger, {
  dirname: 'my-logs',
});
```
<a name="PluginLoggerServer+switch"></a>

#### pluginLoggerServer.switch(dirname)
Change the directory in which the log files are created. Closes all existing writers.

**Kind**: instance method of [<code>PluginLoggerServer</code>](#PluginLoggerServer)  

| Param | Type | Description |
| --- | --- | --- |
| dirname | <code>String</code> \| <code>Object</code> | Path to the new directory. As a convenience  to match the plugin filesystem API, an object containing the 'dirname' key  can also be passed. |

<a name="PluginLoggerServer+createWriter"></a>

#### pluginLoggerServer.createWriter(name, options)
Create a writer.

**Kind**: instance method of [<code>PluginLoggerServer</code>](#PluginLoggerServer)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>String</code> |  | Name of the writer. Used to generate the log file  pathname. |
| options | <code>Object</code> |  | Options for the writer. |
| [options.usePrefix] | <code>Boolean</code> | <code>true</code> | Whether the writer file should  be prefixed with a `YYYY.MM.DD_hh.mm.ss_uid_` string. |
| [options.allowReuse] | <code>Boolean</code> | <code>false</code> | If `usePrefix` is false, allow  to reuse an existing underlying file for the writer. New data will be  appended to the file.  Can be usefull to log global informations in the same file amongst different  sessions. |

<a name="WriterClient"></a>

### WriterClient
Client-side stream writer.

Created and retrived by the client-side `logger.createWriter(name, bufferSize)` and
`logger.attachWriter(name, bufferSize)` methods.

**Kind**: global class  

* [WriterClient](#WriterClient)
    * [.onPacketSend(callback)](#WriterClient+onPacketSend) ⇒
    * [.onClose(callback)](#WriterClient+onClose) ⇒

<a name="WriterClient+onPacketSend"></a>

#### writerClient.onPacketSend(callback) ⇒
Register a function to be executed when a packet is sent on the network.,
i.e. when the buffer is full or flushed on close.

**Kind**: instance method of [<code>WriterClient</code>](#WriterClient)  
**Returns**: Function that unregister the listener when executed.  

| Param | Type | Description |
| --- | --- | --- |
| callback | <code>function</code> | Function to execute on close. |

<a name="WriterClient+onClose"></a>

#### writerClient.onClose(callback) ⇒
Register a function to be executed when the Writer is closed. The function
will be executed after the buffer has been flushed and underlying state has
been deleted, and before the `close` Promise resolves.

**Kind**: instance method of [<code>WriterClient</code>](#WriterClient)  
**Returns**: Function that unregister the listener when executed.  

| Param | Type | Description |
| --- | --- | --- |
| callback | <code>function</code> | Function to execute on close. |

<a name="WriterServer"></a>

### WriterServer
Server-side stream writer.

Created and retrived by the server-side `logger.createWriter(name)` method.

**Kind**: global class  

* [WriterServer](#WriterServer)
    * [.name](#WriterServer+name)
    * [.pathname](#WriterServer+pathname)
    * [.write(data)](#WriterServer+write)
    * [.close()](#WriterServer+close) ⇒ <code>Promise</code>
    * [.onClose(callback)](#WriterServer+onClose) ⇒

<a name="WriterServer+name"></a>

#### writerServer.name
Name of the Writer.

**Kind**: instance property of [<code>WriterServer</code>](#WriterServer)  
**Read only**: true  
<a name="WriterServer+pathname"></a>

#### writerServer.pathname
Pathname of the Writer.

**Kind**: instance property of [<code>WriterServer</code>](#WriterServer)  
**Read only**: true  
<a name="WriterServer+write"></a>

#### writerServer.write(data)
Format and write data.
- Successive write calls are added to a new line
- Data can be of any type, it will be stringified before write.
- TypedArrays are converted to Array before being stringified.

**Kind**: instance method of [<code>WriterServer</code>](#WriterServer)  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>Any</code> | Data to be written |

<a name="WriterServer+close"></a>

#### writerServer.close() ⇒ <code>Promise</code>
Close the stream,

**Kind**: instance method of [<code>WriterServer</code>](#WriterServer)  
**Returns**: <code>Promise</code> - Promise that resolves when the stream is closed  
<a name="WriterServer+onClose"></a>

#### writerServer.onClose(callback) ⇒
Register a function to be executed when the Writer is closed. The function
will be executed when the underlying stream is closed and before the `close()`
Promise is resolved.

**Kind**: instance method of [<code>WriterServer</code>](#WriterServer)  
**Returns**: Function that unregister the listener when executed.  

| Param | Type | Description |
| --- | --- | --- |
| callback | <code>function</code> | Function to execute on close. |


<!-- apistop -->

## Credits

The code has been initiated in the framework of the WAVE and CoSiMa research projects, funded by the French National Research Agency (ANR).

## License

BSD-3-Clause
