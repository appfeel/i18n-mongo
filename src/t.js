import path from 'path';
import { hashCode } from './util';
import { missing } from './locales';
import { getCachedTranslation, isCached, setCachedTranslation, removeCached } from './strCache';
import { addNewLanguage, Locale, Logger } from './i18n-mongo';


function getTranslation(localesData, tHash, requestedText, lang, type, extra, templateData) {
    let translation;
    let text;

    if (localesData.length) {
        if (!localesData[0].strings.length || !localesData[0].strings[0].text.length) {
            Logger.warning(`Still missing translation for "${requestedText}" (${lang})`);
            text = requestedText;
        } else {
            text = localesData[0].strings[0].text;
        }
    } else {
        text = requestedText;
    }

    try {
        const compiled = setCachedTranslation(text, lang, tHash);
        translation = compiled(templateData);
    } catch (e) {
        Logger.error(`Handlebars error (t function): ${requestedText}, ${lang}, ${e}`);
        translation = requestedText;
    }

    return translation;
}

/**
 * Translates text and inserts in database automatically if it does not exist.
 *
 * @param {String} text The text to be translated
 * @param {Object} options options configuration object
 * @param {String} options.lang the desired language,
 * @param {String} [options.type=server] type of translation 'client', 'server', etc...
 * @param {String} [options.extra] An extra string to identify where the translation comes from
 * @param {String} [options.templateData] If translation is a handlebars template data
 * to be used in template
 * @returns {Promise.<string, Error>} a promise that will be resolved
 * with the translated string or rejected with corresponding error
 */
function tString(text, options) {
    const { lang, type, extra, templateData } = options;
    const tHash = hashCode(text);
    let promise;

    if (isCached(tHash, lang)) {
        promise = Promise.resolve(getCachedTranslation(tHash, lang, templateData));
    } else {
        promise = addNewLanguage(lang)
            .then(() => Locale
                .aggregate([
                    { $match: { 'strings.text': text } },
                    {
                        $project: {
                            strings: {
                                $filter: {
                                    input: '$strings',
                                    as: 'string',
                                    cond: { $eq: ['$$string.lang', lang] }, // { $or: [{ $eq: ['$$string.lang', lang] }, { $eq: ['$$string.lang', '--'] }] },
                                },
                            },
                        },
                    },
                ])
                .exec())
            .then((localesData) => {
                if (!localesData.length) {
                    // Insert where did we found the template as extra data
                    missing({ text, lang, type: type || 'server', extra });
                }
                return getTranslation(localesData, tHash, text, lang, type || 'server', extra, templateData || {});
            });
    }

    return promise;
}

function getCallerName() {
    // See http://stackoverflow.com/a/36152335/513570
    // Get function caller name
    const stack = new Error().stack.split('    at ');
    const regex = new RegExp(path.dirname(require.main.filename), 'g');
    const from = stack.slice(3).reduce((curr, v) => {
        if (!/(^process\._tickCallback|^next \(native\))/g.test(v)) {
            curr.push(v.replace(/\n/g, '').replace(regex, ''));
        }
        return curr;
    }, []);
    return from[0] || stack[2].replace(__dirname, '');
}

/**
 * Translates text and inserts in database automatically if it does not exist.
 *
 * @param {string|string[]} text The text (string) or texts (array) to be translated
 * @param {Object} options options configuration object
 * @param {String} options.lang the desired language,
 * @param {String} [options.type=server] type of translation 'client', 'server', etc...
 * @param {String} [options.extra] An extra string to identify where the translation comes from
 * @param {String} [options.templateData] If translation is a handlebars template data
 * to be used in template
 * @returns {Promise.<string, Error>|Promise.<string[], Error>} a promise that will be resolved
 * with the translated string (if text is just a string) or with an array of strings (if text
 * is an array of strings) or rejected with corresponding error
 */
export default function t(text, options) {
    const sCallerName = getCallerName();
    let promise;
    // eslint-disable-next-line no-param-reassign
    options.extra = options.extra || sCallerName;

    if (typeof text === 'string') {
        promise = tString(text, options);
    } else {
        const promises = [];
        Object.keys(text).forEach(i => promises.push(tString(text[i], options)));
        promise = Promise.all(promises);
    }
    return promise;
}

export function setTranslation(defaultText, newText, lang) {
    const sCallerName = getCallerName();
    if (defaultText && lang) {
        const query = { strings: { $elemMatch: { text: defaultText, lang: '--' } } };

        return addNewLanguage(lang)
            .then(() => Locale.find(query))
            .then((locales) => {
                if (!locales.length) {
                    return missing({ text: defaultText, lang, type: 'server', extra: sCallerName })
                        .then(() => Locale.find(query));
                }
                return locales;
            })
            .then(locales => locales.map((locale) => {
                const tHash = hashCode(defaultText);
                const isNotHavinLocale = locale.strings.every((string) => {
                    if (string.lang === lang) {
                        // eslint-disable-next-line no-param-reassign
                        string.text = newText;
                        return false;
                    }
                    return true;
                });

                if (isNotHavinLocale) {
                    locale.strings.push({
                        text: newText,
                        lang,
                        extra: sCallerName,
                    });
                }

                removeCached(tHash, lang);

                return locale.save();
            }))
            .then(promises => Promise.all(promises));
    }
    return Promise.resolve([]);
}
