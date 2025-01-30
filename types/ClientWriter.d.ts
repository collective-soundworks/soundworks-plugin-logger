/**
 * Client-side stream writer.
 *
 * Created and retrieved by the client-side `logger.createWriter(name, bufferSize)` and
 * `logger.attachWriter(name, bufferSize)` methods.
 */
export default class ClientWriter {
    /** hideconstructor */
    constructor(plugin: any, state: any, bufferSize?: number);
    /**
     * Name of the Writer.
     * @readonly
     */
    readonly get name(): any;
    /**
     * Pathname of the Writer.
     * @readonly
     */
    readonly get pathname(): any;
    /**
     * Format and write data.
     * - Successive write calls are added to a new line
     * - Data can be of any type, it will be stringified before write.
     * - TypedArrays are converted to Array before being stringified.
     * @param {Any} data - Data to be written
     */
    write(data: Any): void;
    /**
     * Flush the buffer, only applies if `bufferSize` option is set.
     */
    flush(): void;
    /**
     * Close the writer.
     * @returns {Promise} Promise that resolves when the stream is closed
     */
    close(): Promise<any>;
    /**
     * Register a function to be executed when a packet is sent on the network.,
     * i.e. when the buffer is full or flushed on close.
     * @param {Function} callback - Function to execute on close.
     * @returns {Function} that unregister the listener when executed.
     */
    onPacketSend(callback: Function): Function;
    /**
     * Register a function to be executed when the Writer is closed. The function
     * will be executed after the buffer has been flushed and underlying state has
     * been deleted, and before the `close` Promise resolves.
     * @param {Function} callback - Function to execute on close.
     * @returns {Function} that unregister the listener when executed.
     */
    onClose(callback: Function): Function;
    #private;
}
//# sourceMappingURL=ClientWriter.d.ts.map