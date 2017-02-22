import moment from 'moment';

// http://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
/* eslint-disable no-bitwise */
export function hashCode(str) {
    let hash = 0;
    let i;
    let chr;
    let len;

    if (str.length === 0) {
        return hash;
    }

    for (i = 0, len = str.length; i < len; i += 1) {
        chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}
/* eslint-enable */

export function formatDate(date, lang, format) {
    return moment(date).locale(lang).format(format);
}

// /**
//  * JS Implementation of MurmurHash3 (r136) (as of May 20, 2011)
//  *
//  * @author <a href="mailto:gary.court@gmail.com">Gary Court</a>
//  * @see http://github.com/garycourt/murmurhash-js
//  * @author <a href="mailto:aappleby@gmail.com">Austin Appleby</a>
//  * @see http://sites.google.com/site/murmurhash/
//  *
//  * @param {String} key ASCII only
//  * @param {Number} seed Positive integer only
//  * @return {Number} 32-bit positive integer hash
//  */
// /* eslint-disable no-bitwise, no-plusplus, default-case, no-fallthrough */
// export function murmurhash3(key, seed) {
//     const remainder = key.length & 3; // key.length % 4
//     const bytes = key.length - remainder;
//     const c1 = 0xcc9e2d51;
//     const c2 = 0x1b873593;
//     let h1 = seed;
//     let i = 0;
//     let h1b;
//     let k1;

//     while (i < bytes) {
//         k1 =
//             ((key.charCodeAt(i) & 0xff)) |
//             ((key.charCodeAt(++i) & 0xff) << 8) |
//             ((key.charCodeAt(++i) & 0xff) << 16) |
//             ((key.charCodeAt(++i) & 0xff) << 24);
//         ++i;

//         k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
//         k1 = (k1 << 15) | (k1 >>> 17);
//         k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;

//         h1 ^= k1;
//         h1 = (h1 << 13) | (h1 >>> 19);
//         h1b = ((((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16))) & 0xffffffff;
//         h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16));
//     }

//     k1 = 0;

//     switch (remainder) {
//         case 3: k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
//         case 2: k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
//         case 1: k1 ^= (key.charCodeAt(i) & 0xff);

//             k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
//             k1 = (k1 << 15) | (k1 >>> 17);
//             k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
//             h1 ^= k1;
//     }

//     h1 ^= key.length;

//     h1 ^= h1 >>> 16;
//     h1 = (((h1 & 0xffff) * 0x85ebca6b) +
//         ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
//     h1 ^= h1 >>> 13;
//     h1 = ((((h1 & 0xffff) * 0xc2b2ae35) +
//         ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16))) & 0xffffffff;
//     h1 ^= h1 >>> 16;

//     return h1 >>> 0;
// }
// /* eslint-enable */
