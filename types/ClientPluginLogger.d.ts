/**
 * Client-side representation of the soundworks sync plugin.
 *
 * The constructor should never be called manually. The plugin will be
 * instantiated by soundworks when registered in the `pluginManager`
 *
 * @example
 * client.pluginManager.register('logger', ClientPluginLogger);
 */
export default class ClientPluginLogger {
    /** @hideconstructor */
    constructor(client: any, id: any, options: any);
    options: any;
    /** @private */
    private start;
    /** @private */
    private stop;
    /**
     * Create a writer.
     *
     * @param {String} name - Name of the writer. Used to generate the log file
     *  pathname.
     * @param {Object} options - Options for the writer.
     * @param {Number} [options.bufferSize=1] - Number of writes buffered before
     *  sending the logs to the server.
     * @param {Boolean} [options.usePrefix=true] - Whether the writer file should
     *  be prefixed with a `YYYY.MM.DD_hh.mm.ss_uid_` string.
     * @param {Boolean} [options.allowReuse=false] - If `usePrefix` is false, allow
     *  to reuse an existing underlying file for the writer. New data will be
     *  appended to the file.
     *  Can be useful to log global information in the same file amongst different
     *  sessions.
     */
    createWriter(name: string, { bufferSize, usePrefix, allowReuse, }?: {
        bufferSize?: number;
        usePrefix?: boolean;
        allowReuse?: boolean;
    }): Promise<any>;
    /**
     * Attach to a shared writer created by the server. Can be useful to create
     * files that gather information from multiple nodes.
     *
     * @param {String} name - Name of the writer. Used to generate the log file
     *  pathname.
     * @param {Object} options - Options for the writer.
     * @param {Number} [options.bufferSize=1] - Number of writes buffered before
     *  sending the logs to the server.
     */
    attachWriter(name: string, { bufferSize }?: {
        bufferSize?: number;
    }): Promise<ClientWriter>;
    #private;
}
import ClientWriter from './ClientWriter.js';
//# sourceMappingURL=ClientPluginLogger.d.ts.map