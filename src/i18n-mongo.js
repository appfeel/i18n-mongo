import mongoose, { Schema } from 'mongoose';
import emailer from './emailer';
import strCache from './strCache';

mongoose.Promise = Promise;
const LANG_MAX_AGE = 20 * 365 * 24 * 3600 * 1000;
const langSchema = new Schema({
    lang: String,
    displayName: String,
});
const localeSchema = new Schema({
    strings: [
        {
            _id: false,
            lang: String,
            text: String,
            extra: String,
        },
    ],
    refs: [Schema.Types.ObjectId],
});
const localeTypesSchema = new Schema({
    type: String,
});
const mAvailableLangs = [];


// eslint-disable-next-line func-names
localeTypesSchema.statics.findAndModify = function (query, sort, update, opts, callback) {
    const cb = callback || (() => { });
    const result = this.collection.findAndModify(query || {}, sort || [], update || {}, opts);
    return result.then((retVal) => {
        cb(null, retVal.value);
        return retVal.value;
    }).catch(cb);
};

/* eslint-disable import/no-mutable-exports */
// Exporting let allows to initialize this variables
export let Lang;
export let Locale;
export let LocaleTypes;
export let DefaultLanguage = 'en';
export let Logger = {
    log: () => { },
    error: () => { },
    warning: () => { },
    info: () => { },
};
/* eslint-enable import/no-mutable-exports */
export const LocalizedRefKey = 'i18nMongoLocalized';
export const Localized = { type: Schema.Types.ObjectId, ref: LocalizedRefKey };

function selectDialect(acceptLanguages, defaultLanguage) {
    // ['ca', 'en-UK;q=0.8', 'fr;q=0.6', 'es-ES;q=0.4', 'es;q=0.2']
    // Look for a different dialect: maybe we have en-US or fr-CA or ex-MX
    for (let i = 0; i < acceptLanguages.length; i += 1) {
        let lang = acceptLanguages[i].split(';')[0];
        lang = lang.indexOf('-') < 0 ? lang : lang.split('-')[0];
        for (let l = 0; l < mAvailableLangs.length; l += 1) {
            if (mAvailableLangs[l].indexOf(lang) === 0) {
                return mAvailableLangs[l];
            }
        }
    }
    // No language found, return default
    return defaultLanguage;
}

function selectLang(acceptLanguages, defaultLanguage) {
    // ['ca', 'en-UK;q=0.8', 'fr;q=0.6', 'es-ES;q=0.4', 'es;q=0.2']
    for (let i = 0; i < acceptLanguages.length; i += 1) {
        const lang = acceptLanguages[i].split(';')[0];
        if (mAvailableLangs.indexOf(lang.toLowerCase()) >= 0) {
            return lang.toLowerCase();
        }
    }

    // We only get here if no language has been found
    return selectDialect(acceptLanguages, defaultLanguage);
}

function appendLanguage(lang) {
    let isNew = false;
    if (mAvailableLangs.indexOf(lang.toLowerCase()) < 0) {
        isNew = true;
        mAvailableLangs.push(lang.toLowerCase());
    }

    return isNew;
}

export function initLanguages() {
    mAvailableLangs.splice(0, mAvailableLangs.length);
    return Lang.find().exec()
        .then((langData) => {
            for (let l = 0; l < langData.length; l += 1) {
                appendLanguage(langData[l].lang);
            }
            return mAvailableLangs;
        });
}

/**
 * Called that is called when available languages have been loaded
 *
 * @callback availableLanguagesCallback
 * @param {Error} [err] the error exception if any
 */
/**
 * Library entry point. This will find all locales and return the middleware
 * to get language from request.
 *
 * @param {Object} [options] options configuration object
 * @param {String} [options.defaultLanguage=en] Default language to use
 * @param {String} [options.defaultLocaleType=document] Default locale type to use for documents
 * @param {String} [options.maxAge=LANG_MAX_AGE] maxAge for 'lang' cookie
 * @param {String} [options.isSetCookie=true] use 'lang' cookie to store language settings
 * @param {Object} [options.logger] logger object to send log messages
 * (must implement error, info and waring methods)
 * @param {Object} [options.email] If provided, will be used to communicate missing translations
 * @param {String} options.email.transport must implement sendMail(message, callback)
 * @param {String} options.email.from 'from' field when a message is sent
 * @param {String} options.email.to the receiver of the emails
 * @param {String} [options.langModelName=i18nmongolang] the mongo collection name for Lang
 * @param {String} [options.langCookieName=lang] the lang cookie name
 * @param {String} [options.localeTypesModelName=i18nmongolocaletypes] the mongo collection
 * name for LangTypes
 * @param {Number} [options.cacheMaxKeys=10000] number of maximum keys to be stored in cache
 * @param {Number} [options.cacheExpire=6hours] cached key expire time (in milliseconds)
 * @param {availableLanguagesCallback} [callback] called when available languages
 * @returns {Function} express middleware function
 */
export default function i18nMongo(options, callback) {
    const cb = callback || ((err) => {
        if (err) {
            Logger.error(`Error selecting language: ${err}`);
        }
    });
    const { defaultLanguage, maxAge, isSetCookie, logger, email,
        langModelName, langCookieName, localeModelName, localeTypesModelName,
        cacheMaxKeys, cacheExpire } = Object.assign({
            defaultLanguage: DefaultLanguage,
            maxAge: LANG_MAX_AGE,
            isSetCookie: true,
            logger: Logger,
            langModelName: 'i18nmongolang',
            langCookieName: 'lang',
            localeModelName: 'i18nmongolocale',
            localeTypesModelName: 'i18nmongolocaletypes',
            cacheMaxKeys: 10000,
            cacheExpire: 6 * 3600 * 1000, // 6h
        }, options || {});

    Logger = logger;
    DefaultLanguage = defaultLanguage;
    Lang = mongoose.models[langModelName] || mongoose.model(langModelName, langSchema);
    Locale = mongoose.models[localeModelName] || mongoose.model(localeModelName, localeSchema);
    LocaleTypes = mongoose.models[localeTypesModelName]
        || mongoose.model(localeTypesModelName, localeTypesSchema);

    if (email) {
        emailer(email);
    }

    strCache(cacheMaxKeys, cacheExpire);
    initLanguages().then(() => cb()).catch(cb);

    return (req, res, next) => {
        /* eslint-disable no-param-reassign */
        if (req.cookies && req.cookies.lang) {
            req.lang = req.cookies.lang;
        } else {
            // Ex: 'ca,en-UK;q=0.8,fr;q=0.6,es-ES;q=0.4,es;q=0.2'
            const acceptLanguage = (req.headers || {})['accept-language'] || '';
            req.lang = acceptLanguage ? selectLang(acceptLanguage.split(','), defaultLanguage) : defaultLanguage;
            if (isSetCookie) {
                res.cookie(langCookieName, req.lang, {
                    maxAge,
                    httpOnly: false,
                });
            }
        }
        /* eslint-enable no-param-reassign */
        next();
    };
}

export function getAvailableLangs(data) {
    return Lang.find(data).sort({ lang: 1 }).exec();
}

export function addNewLanguage(lang, displayName) {
    if (appendLanguage(lang)) {
        return Lang.findOneAndUpdate(
            { lang },
            { lang, displayName: displayName || '' },
            { new: true, upsert: true },
        ).exec();
    }

    return Promise.resolve();
}

