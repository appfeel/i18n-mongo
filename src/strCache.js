import handlebars from 'handlebars';
import { formatDate, hashCode } from './util';

let cached = {};
let hashes = [];
let CacheMaxKeys = 10000;
let CacheExpire = 6 * 3600 * 1000; // 6h
let cachedCount = 0;
let isPurging = false;

export default function init(cacheMaxKeys, cacheExpire) {
    CacheExpire = cacheExpire;
    CacheMaxKeys = cacheMaxKeys;
}

export function registerHelpers(helpers) {
    Object.keys(helpers).forEach(h => handlebars.registerHelper(h, helpers[h]));
}

registerHelpers({
    formatDate: (date, lang) => formatDate(date, lang, 'LL'),
    formatDateTime: (date, lang) => formatDate(date, lang, 'LLLL'),
});

export function cleanCache() {
    cached = {};
    hashes = [];
    cachedCount = 0;
}

export const __testonly__ = {
    purgeCache: function purgeCache() {
        const now = new Date().getTime();
        const tHashes = Object.keys(cached);
        let hLen = tHashes.length;

        for (let h = 0; h < hLen; h += 1) {
            const hash = tHashes[h];
            const langs = Object.keys(cached[hash]);
            const langsLen = langs.length;
            let deletedLangs = 0;
            for (let l = 0; l < langsLen; l += 1) {
                const lang = langs[l];
                if (cached[hash][lang] && now - cached[hash][lang].lastRequested >= CacheExpire
                ) {
                    hashes.splice(hashes.indexOf(`${hash}-${lang}`), 1);
                    delete cached[hash][lang];
                    deletedLangs += 1;
                }
            }
            if (langsLen - deletedLangs === 0) {
                delete cached[hash];
                tHashes.splice(h, 1);
                h -= 1;
                hLen -= 1;
            }
        }

        hLen = hashes.length;
        if (hLen > CacheMaxKeys) {
            for (let h = 0; h < hLen - CacheMaxKeys; h += 1) {
                const hashComposed = hashes[h].split('::');
                delete cached[hashComposed[0]][hashComposed[1]];
                if (Object.keys(cached[hashComposed[0]]).length === 0) {
                    delete cached[hashComposed[0]];
                }
            }
        }
        isPurging = false;
    },
};

export function isCached(tHash, lang) {
    return cached[tHash] !== undefined && cached[tHash][lang] !== undefined;
}

export function removeCached(tHash, lang) {
    if (isCached(tHash, lang)) {
        delete cached[tHash][lang];
    }
}

export function getCachedTranslation(tHash, lang, templateData) {
    if (isCached(tHash, lang)) {
        cached[tHash][lang].lastRequested = new Date().getTime();
        return cached[tHash][lang].compiled(templateData || {});
    }

    return '';
}

export function setCachedTranslation(text, lang, hash) {
    const isTemplate = /\{\{.*\}\}/g.test(text);
    const tHash = hash || hashCode(text);

    if (cached[tHash] && cached[tHash][lang]) {
        hashes.push(hashes.splice(hashes.indexOf(`${tHash}::${lang}`), 1));
    } else {
        hashes.push(`${tHash}::${lang}`);
        cached[tHash] = cached[tHash] || {};
        cached[tHash][lang] = cached[tHash][lang] || {};
        cached[tHash][lang].compiled = isTemplate ? handlebars.compile(text) : () => text;
    }

    cached[tHash][lang].lastRequested = new Date().getTime();
    if (cachedCount > CacheMaxKeys && !isPurging) {
        isPurging = true;
        setTimeout(__testonly__.purgeCache, 1);
    }
    cachedCount += 1;

    return cached[tHash][lang].compiled;
}
