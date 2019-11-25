
// /**
//  * Time, in seconds, relative to the first call of this function.
//  *
//  * @returns {Number} time in seconds.
//  */
// export function time() {
//   const hrtime = process.hrtime();
//   const lrtime = hrtime[0] + hrtime[1] * 1e-9;
//   time.started = time.started || lrtime;

//   return lrtime - time.started;
// }


// /**
//  * Returns a date suitable for a file name.
//  *
//  * @returns {String} date as YYYYMMDD_hhmmss
//  */
// export function date() {
//   const date = new Date();

//   const year = date.getFullYear();
//   const month = pad('00', date.getMonth() + 1); // Month starts at 0
//   const day = pad('00', date.getDate());

//   const hours = pad('00', date.getHours());
//   const minutes = pad('00', date.getMinutes());
//   const seconds = pad('00', date.getSeconds());

//   return `${year}${month}${day}_${hours}${minutes}${seconds}`;
// }


// /**
//  * Pad a string with a prefix.
//  *
//  * @param {String} prefix
//  * @param {String} radical
//  * @returns {String} concatenation of prefix + radical, sliced to the minimum of
//  *                   the prefix or radical size.
//  */
// export function pad(prefix, radical) {
//   const string = (typeof radical === 'string'
//                   ? radical
//                   : radical.toString() );

//   const slice = (string.length > prefix.length
//                   ? prefix.length
//                   : -prefix.length);
//   return (prefix + string).slice(slice);
// }
