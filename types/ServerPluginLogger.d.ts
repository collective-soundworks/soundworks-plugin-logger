export const kNodeIdWritersMap: any;
export const kPathnameWriterMap: any;
export const kInternalState: any;
/**
 * Server-side representation of the soundworks logger plugin.
 *
 * The constructor should never be called manually. The plugin will be
 * instantiated by soundworks when registered in the `pluginManager`
 *
 * Available options:
 * - `[dirname=null]` {String} - The directory in which the log files should
 *  be created. If `null` the plugin is in some "idle" state, and any call
 *  to `createWriter` (or client-side `attachWriter`) will throw an error.
 *  The directory can be changed at runtime using the `switch` method.
 *
 * @example
 * server.pluginManager.register('logger', ServerPluginLogger, {
 *   dirname: 'my-logs',
 * });
 */
export default class ServerPluginLogger {
    /** @hideconstructor */
    constructor(server: any, id: any, options: any);
    options: any;
    /** @private */
    private start;
    /** @private */
    private stop;
    /** @private */
    private addClient;
    /** @private */
    private removeClient;
    /**
     * Change the directory in which the log files are created. Closes all existing writers.
     *
     * @param {String|Object} dirname - Path to the new directory. As a convenience
     *  to match the plugin filesystem API, an object containing the 'dirname' key
     *  can also be passed.
     */
    switch(dirname: string | any): Promise<void>;
    /**
     * Create a writer.
     * @param {String} name - Name of the writer. Used to generate the log file
     *  pathname.
     * @param {Object} options - Options for the writer.
     * @param {Boolean} [options.usePrefix=true] - Whether the writer file should
     *  be prefixed with a `YYYY.MM.DD_hh.mm.ss_uid_` string.
     * @param {Boolean} [options.allowReuse=false] - If `usePrefix` is false, allow
     *  to reuse an existing underlying file for the writer. New data will be
     *  appended to the file.
     *  Can be useful to log global information in the same file amongst different
     *  sessions.
     */
    createWriter(name: string, { usePrefix, allowReuse, }?: {
        usePrefix?: boolean;
        allowReuse?: boolean;
    }): Promise<ServerWriter>;
    #private;
}
import ServerWriter from './ServerWriter.js';
//# sourceMappingURL=ServerPluginLogger.d.ts.map