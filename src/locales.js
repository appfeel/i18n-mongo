import mongoose, { Schema } from 'mongoose';
import clone from 'clone';
import { expandPath, getObjectByPath, updateObjectByPath } from 'jsobjects';
import { addNewLanguage, DefaultLanguage, Locale, LocaleTypes, Logger, LocalizedRefKey } from './i18n-mongo';
import { fromTemplate as emailFromTemplate } from './emailer';

function notifyMissing({ type, text, lang, extra }) {
    Logger.info(`Inserted new translation for "${text}" - "${lang}"`);
    emailFromTemplate('missingTranslation', {}, { type, text, lang, extra })
        .catch(Logger.error);
}

/**
 * For a given type returns a promise which resolves to the type
 * upserting it when not found
 * @param {Object} data the data to look for
 * @param {String} data.type the type of the locale
 * @param {String} data.text the text of the locale in default language
 * @return {Promise} resolves to the type doc and found locales docs in an array
 */
export function getTypeDoc(type) {
    return LocaleTypes.findAndModify(
        { type }, [], { $setOnInsert: { type } }, { new: true, upsert: true });
}

/**
 * For a given text and type returns a promise which
 * resolves to the type and found locales in an array,
 * upserting type when not found
 * @param {Object} data the data to look for
 * @param {String} data.type the type of the locale
 * @param {String} data.text the text of the locale in default language
 * @return {Promise} resolves to the type doc and found locales docs in an array
 */
function getTypeDocAndLocales({ type, text }) {
    // find or create: http://stackoverflow.com/a/16362833/4025963
    const findTypeDoc = getTypeDoc(type);
    const findDocLocales = findTypeDoc.then(typeDoc => Locale.find({
        refs: typeDoc._id,
        strings: { $elemMatch: { text } },
    }).exec());

    return Promise.all([findTypeDoc, findDocLocales]);
}

/**
 * A locale is composed by the original string (default language)
 * and a set of translations:
 *
 *     [ {
 *         strings: [
 *             { lang: '--', text: 'A locale', extra: '' },
 *             { lang: 'ca', text: 'Un local', extra: '' },
 *         ],
 *         refs: ['58a54d35919e4720d84199d5', '58a54d35919e4720d84199d6']
 *     } ]
 *
 * Creates an empty translation entry for a locale.
 * Creates the new locale too if it doesn't exist.
 * Does nothing if lang is DefaultLanguage.
 * @param {Object} data the missing translation data:
 * @param {String} data.type the type of the locale
 * @param {String} data.text the text of the locale in default language
 * @param {String} data.lang the language of missing translation
 * @param {String} [data.extra] any extra data (only for info purposes)
 * @return {Promise} resolves to the new inserted/saved doc or empty if nothing done
 */
export function missing({ type, text, lang, extra }) {
    if (lang !== DefaultLanguage) {
        return getTypeDocAndLocales({ type, text, lang, extra })
            .then(([typeDoc, locales]) => {
                if (locales && locales.length) {
                    // Already existed a locale for this text
                    const isNotPresent = locales[0].strings.every(str => (str.lang !== lang));
                    if (isNotPresent) {
                        // Insert the new language translation
                        locales[0].strings.push({ lang, text: '' });
                        return locales[0].save();
                    }
                    // The translation already exists
                    return Promise.resolve();
                }
                // The original string does not exist:
                // Insert both: not localized and localized
                return new Locale({
                    refs: [typeDoc._id],
                    strings: [
                        { text, lang: '--' }, // -- represents default language
                        { text: '', lang, extra },
                    ],
                }).save();
            })
            .then((saveResult) => {
                if (saveResult) {
                    notifyMissing({ type, text, lang, extra });
                }
                return Promise.resolve(saveResult);
            });
    }

    return Promise.resolve();
}

function getLocalizedKeys(schema) {
    const paths = schema.paths;
    const pathKeys = Object.keys(paths);
    const localizedKeys = [];
    pathKeys.forEach((key) => {
        const p = paths[key];
        if (p instanceof Schema.Types.ObjectId
            && p.options && p.options.ref === LocalizedRefKey) {
            localizedKeys.push(key);
        } else if (p instanceof Schema.Types.DocumentArray) {
            const stk = getLocalizedKeys(p.schema);
            stk.forEach(subKey => localizedKeys.push(`${key}.*.${subKey}`));
        }
    });
    return localizedKeys;
}

/**
 * Save all locales for a document field.
 * The document field must be in the form
 *
 *     { _id: '', strings: [ { lang: 'ca', text: 'Text del local', extra: '' }, ... ], refs: [...]}
 */
function saveLocale(original, value) {
    // if (!value) {
    //     return Promise.reject('Invalid value');
    // } else
    if (value._id) {
        // The provided value is itself a locale
        return Locale.updateOne({ _id: value._id }, { $set: value }).exec()
            .then(() => Locale.findOne(value._id));
    } else if (original) {
        // Update original locale with provided values and save it
        value.strings.forEach((string) => {
            const isNew = original.strings.every((ostring, idx) => {
                if (ostring.lang === string.lang) {
                    // eslint-disable-next-line no-param-reassign
                    original.strings[idx] = string; // Update this string
                    return false;
                }
                return true;
            });
            if (isNew) {
                original.strings.push(string);
            }
        });
        return Locale.updateOne({ _id: original._id }, { $set: original }).exec()
            .then(() => Locale.findOne(original._id));
        // return original.save();
    }

    // Search in db if there exists a similar locale
    return Promise.all(value.strings.map(string => Locale.find({
        $or: [
            { strings: { $elemMatch: { text: string.text, lang: string.lang } } },
            { strings: { $elemMatch: { text: string.text, lang: DefaultLanguage } } },
            { strings: { $elemMatch: { text: string.text, lang: '--' } } },
        ],
    }).limit(1).lean().exec()))
        .then((foundLocales) => {
            let match = -1;
            foundLocales.every((foundLocale, idx) => {
                if (foundLocale && foundLocale.length) {
                    match = idx;
                    return false;
                }
                return true;
            });

            if (match > -1) {
                // Set the found locale as the new original
                return saveLocale(foundLocales[match][0], value);
            }

            // The locale is not found in db
            const isNoDefault = value.strings.every(str => str.lang !== '--');
            if (isNoDefault) {
                value.strings.push({ lang: '--', text: value.strings[0].text, extra: '' });
            }
            notifyMissing({ type: '', text: value.strings[0].text, lang: '--', extra: '' });
            return new Locale(value).save();
        });
}

function processLocales(Model, docData, localizedKeys, lang) {
    const detectedLangs = [lang];
    let isRecoverOriginal = false;
    let promise;

    // Get expanded fields (localized keys is just the expandable path)
    const fields = localizedKeys.reduce((fs, key) => {
        if (/\.\*\./i.test(key)) {
            fs.push(...expandPath(docData, key));
        } else {
            fs.push(key);
        }
        return fs;
    }, []);

    // Get provided values for each localized key
    // and homogenize to std locale format: { strings: [], refs: [] }
    const newLocales = fields.map((field) => {
        let newLocale;
        try {
            newLocale = getObjectByPath(docData, field);
        } catch (e) {
            Logger.error(e);
        }

        if (newLocale || newLocale === '') {
            if (typeof newLocale === 'string') {
                isRecoverOriginal = isRecoverOriginal || docData._id !== undefined;
                newLocale = {
                    strings: [{ lang: lang || '--', text: newLocale, extra: '' }],
                    refs: docData._id ? [docData._id] : [],
                };
            } else {
                if (!newLocale._id) {
                    isRecoverOriginal = isRecoverOriginal || docData._id !== undefined;
                }
                detectedLangs.push(...newLocale.strings.map(str => str.lang));
                newLocale.refs = newLocale.refs || [];
            }
        }
        return newLocale;
    });

    // Promises have to be serialized in order to save each locale after previous done
    // this is because if locale is repeated, do not duplicate locale, just get previous locale
    const results = [];
    if (isRecoverOriginal) {
        // Recover document with full locales object in every localized key
        // and merge it with provided values
        promise = Model.findLocalized(docData._id)
            .then((docs) => {
                if (docs && docs.length) {
                    return docs[0];
                }
                return docData;
            })
            .then(doc => fields.map(field => getObjectByPath(doc, field)))
            .then(origLocales => newLocales.reduce(
                (p, value, i) => p
                    .then(() => saveLocale(origLocales[i], value).then(r => results.push(r)))
                    .catch(err => results.push(err)),
                Promise.resolve()));
        // .then(origs => Promise.all(values.map((value, i) => saveLocales(origs[i], value))));
    } else {
        promise = newLocales.reduce(
            (p, value) => p
                .then(() => saveLocale(undefined, value).then(r => results.push(r)))
                .catch(err => results.push(err)),
            Promise.resolve());
        // promise = Promise.all(values.map(value => saveLocales(undefined, value)));
    }

    return promise
        .then(() => detectedLangs.map(l => (l && l !== '--' ? addNewLanguage(l) : Promise.resolve())))
        .then(promises => Promise.all(promises))
        .then(() => {
            // Update original document with the locale id
            const newDocData = clone(docData);
            const localeDocs = results.map((result, idx) => {
                if (result && result._id) { // For empty text we do nothing
                    updateObjectByPath(newDocData, fields[idx], result._id);
                }
                return result;
            });
            return {
                newDocData,
                localeDocs,
            };
        });
}

/**
 * Find all locales for a lang which have a refference ref
 *
 * @param {String} ref the mongoose ObjectId for which locales are to be found
 * @param {String} [lang] the language of the locales to be returned
 * @returns {promise} that resolves to the requested locales
 */
export function findByRef(ref, lang = '') {
    let query;
    if (lang) {
        query = Locale.aggregate(
            [
                { $match: { refs: { $in: [ref] } } },
                {
                    $project: {
                        strings: {
                            $filter: {
                                input: '$strings',
                                as: 'string',
                                cond: { $eq: ['$$string.lang', lang] },
                            },
                        },
                    },
                },
            ])
            .exec();
    } else {
        query = Locale.find({ refs: { $in: [ref] } }).lean().exec();
    }

    return query;
}

export async function findLocalesByType(type, lang, options = {}) {
    const askLang = (lang === DefaultLanguage || lang === '--') ? DefaultLanguage : (lang || '--');
    const { isCleanMissing, isOnlyMissing } = options;
    if (askLang) {
        const types = await LocaleTypes.find({ type }).lean().limit(1).exec();
        let locales = [];
        if (types.length) {
            const $match = { refs: types[0]._id };
            if (isCleanMissing) {
                $match.strings = { $elemMatch: { lang: askLang, text: { $ne: '' } } };
            }
            if (isOnlyMissing) {
                $match.$or = [
                    { strings: { $elemMatch: { lang: askLang, text: '' } } },
                    { 'strings.lang': { $nin: [askLang] } },
                ];
            }
            locales = await Locale.aggregate([
                { $match },
                { $unwind: '$strings' },
                { $match: { 'strings.lang': { $in: ['--', askLang] } } },
                { $group: { _id: '$_id', strings: { $push: '$strings.text' } } },
            ]).exec();
        }

        // translations are a json object in the form:
        // 'key_text': 'my super translation'
        return locales.reduce((translations, locale) => {
            if (locale.strings.length > 0) {
                // eslint-disable-next-line no-param-reassign
                translations[locale.strings[0]] = locale.strings[1] || '';
            }
            return translations;
        }, {});
    }

    return {};
}

export function removeLocales(docId) {
    return Locale.find({ refs: docId })
        .exec()
        .then(locales => Promise.all(locales.map((locale) => {
            locale.refs.splice(locale.refs.indexOf(docId), 1);
            if (locale.refs.length) {
                return locale.save();
            }
            return locale.remove();
        })));
}

export function findLocales(Model) {
    return (query, lang) => Model.find(query)
        .limit(1)
        .lean()
        .exec()
        .then(docs => docs.map(doc => findByRef(doc._id, lang).then((locales) => {
            const result = {};
            result[doc._id] = locales;
            return result;
        })))
        .then(promises => Promise.all(promises))
        .then(results => results[0]);
}

function findLocalized(Model) {
    return (query, lang) => {
        const findDocs = Model.find(query).lean().exec();
        const findKLocales = findDocs.then((docs) => {
            const kLocales = {};
            const searchLang = lang === DefaultLanguage ? '--' : lang;
            // Per cada document, busquem els locales que ténen referenciat l'_id del doc
            const searchLocales = docs.map((doc, docIdx) => findByRef(doc._id, searchLang)
                .then((locales) => {
                    kLocales[docIdx] = {};
                    locales.forEach((locale) => {
                        kLocales[docIdx][locale._id.toString()] = locale;
                    });
                    return kLocales;
                }));
            return Promise.all(searchLocales).then(() => kLocales);
        });

        return Promise.all([findDocs, findKLocales])
            .then(([docs, kLocales]) => docs.map((doc, dIdx) => {
                // For each localizedKey, replace the id with corresponding translation
                const keys = Model.localizedKeys; // || getLocalizedKeys(Model.schema);
                keys.forEach((key) => {
                    try {
                        if (/\.\*/ig.test(key)) {
                            // The key needs to be expanded
                            expandPath(doc, key, (path, locId) => {
                                if (locId) {
                                    const locale = kLocales[dIdx][locId.toString()];
                                    if (lang) {
                                        updateObjectByPath(docs[dIdx], path, Object.assign({ text: '' }, locale.strings[0]).text);
                                    } else {
                                        updateObjectByPath(docs[dIdx], path, locale);
                                    }
                                }
                            });
                        } else {
                            const locId = getObjectByPath(doc, key);
                            if (locId) {
                                const locale = kLocales[dIdx][locId.toString()];
                                if (lang) {
                                    updateObjectByPath(docs[dIdx], key, Object.assign({ text: '' }, locale.strings[0]).text);
                                } else {
                                    updateObjectByPath(docs[dIdx], key, locale);
                                }
                            }
                        }
                    } catch (e) {
                        Logger.error(e);
                    }
                });
                return doc;
            }));
    };
}

function saveLocalized(Model) {
    /**
     * Saves a localized document
     * @param {Object} docData the document to be saved
     * @param {string} [docId] the ObjectId if the document already exists
     */
    return (docData, lang) => {
        const keys = Model.localizedKeys; // || getLocalizedKeys(Model.schema);
        const process = processLocales(Model, docData, keys, lang);
        const save = process.then(({ newDocData }) => {
            if (!newDocData._id) {
                return new Model(newDocData).save();
            }
            // eslint-disable-next-line no-param-reassign
            delete newDocData.__v; // __v is automatically be updated
            return Model.findByIdAndUpdate(newDocData._id, { $set: newDocData }, {
                upsert: true,
                new: true,
            }).exec();
        })
            .catch(() => Promise.resolve());

        return Promise.all([process, save])
            .then((results) => {
                const { localeDocs } = results[0];
                const saved = results[1];

                if (saved) {
                    const ids = [];
                    const reducedDocs = [];

                    // Reduce duplicates: in document it could happen that
                    // the same locale is used in multiple places
                    localeDocs.forEach((doc) => {
                        const id = doc && doc._id ? doc._id.toString() : '';
                        if (id && ids.indexOf(id) < 0) {
                            ids.push(id);
                            reducedDocs.push(doc);
                        }
                    });
                    // Update each locale to include the docData._id in refs
                    return Promise.all(reducedDocs.map((doc) => {
                        if (doc && (!doc.refs || doc.refs.indexOf(saved._id) < 0)) {
                            // eslint-disable-next-line no-param-reassign
                            // doc.refs = doc.refs || [];
                            doc.refs.push(saved._id);
                            return doc.save();
                        }
                        return Promise.resolve();
                    })).then(() => saved);
                }

                return Promise.resolve(saved);
            });
    };
}

/**
 * Creates a localizable model with following properties:
 *  - localizedKeys: an array with all localized keys
 *  - findLocales: function that will find all locales for this model
 *  - findLocalized: function that will find the localized document
 *  - saveLocalized: function that will save localized document
 *
 * @param {String} name Name of the schema to create
 * @param {Schema} schema mongoose schema definition
 * @param {String?} collection optional collection name (induced from model name)
 * @param {Boolean?} skipInit whether to skip initialization from mongoose (defaults to false)
 */
export function localizableModel(name, schema, collection, skipInit) {
    schema.pre('remove', function (next) { // eslint-disable-line func-names
        removeLocales(this._id).then(() => next(), next);
    });

    const Model = mongoose.model(name, schema, collection, skipInit);

    Model.localizedKeys = getLocalizedKeys(schema);
    Model.findLocales = findLocales(Model);
    Model.findLocalized = findLocalized(Model);
    Model.saveLocalized = saveLocalized(Model);

    return Model;
}

