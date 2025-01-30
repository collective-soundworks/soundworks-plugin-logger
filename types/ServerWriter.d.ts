export const kWriterBeforeCloseCallback: any;
export const kWriterStream: any;
export const kWriterState: any;
/**
 * Server-side stream writer.
 *
 * Created and retrieved by the server-side `logger.createWriter(name)` method.
 */
export default class ServerWriter {
    /** hideconstructor */
    constructor(state: any, format?: any);
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
    /** @private */
    private open;
    /**
     * Format and write data.
     * - Successive write calls are added to a new line
     * - Data can be of any type, it will be stringified before write.
     * - TypedArrays are converted to Array before being stringified.
     * @param {Any} data - Data to be written
     */
    write(data: Any): void;
    /**
     * Close the writer and the underlying stream.
     * @returns {Promise} Promise that resolves when the stream is closed
     */
    close(): Promise<any>;
    /**
     * Register a function to be executed when the Writer is closed. The function
     * will be executed when the underlying stream is closed and before the `close()`
     * Promise is resolved.
     * @param {Function} callback - Function to execute on close.
     * @returns {Function} that unregister the listener when executed.
     */
    onClose(callback: Function): Function;
    #private;
}
//# sourceMappingURL=ServerWriter.d.ts.map