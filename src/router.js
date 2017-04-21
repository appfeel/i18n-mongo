import bodyParser from 'body-parser';
import { getAvailableLangs, Locale, LocaleTypes } from './i18n-mongo';
import { findByType, getTypeDoc, missing } from './locales';

export const defaultPaths = {
    langs: '/langs',
    clientjs: '/client.js',
    alljson: '/all.json',
    missing: '/missing',
    admin: '/admin',
    types: '/types',
    multi: '/multi',
    root: '/',
    id: '/:_id',
};

function updateLocale(_id, locale) {
    return Locale
        .findOneAndUpdate({ _id }, { $set: locale }, { new: true })
        .exec();
}

export default function i18nMongoRouter(router, options) {
    const opts = options || {};
    const paths = Object.assign({}, defaultPaths, opts.paths || {});
    let auth;

    if (!opts.auth) {
        auth = () => (req, res, next) => next();
    } else {
        auth = path => (req, res, next) => opts.auth(path, req.method)(req, res, next);
    }

    router.use(bodyParser.json());

    // Get all languages
    router.get(paths.langs, auth(paths.langs), (req, res, next) =>
        getAvailableLangs()
            .then(res.json.bind(res))
            .catch(next));

    // Send locales ready for javascript
    router.get(paths.clientjs, auth(paths.clientjs), (req, res, next) =>
        findByType(req.query.type || 'client', req.query.lang || (req.cookies || {}).lang)
            .then((translations) => {
                const js = `var locales = ${JSON.stringify(translations)};`;
                res.setHeader('content-type', 'application/javascript');
                res.send(js);
            })
            .catch(next));

    router.get(paths.alljson, auth(paths.alljson), (req, res, next) =>
        findByType(req.query.type || 'client', req.query.lang || (req.cookies || {}).lang, {
            isOnlyMissing: req.query.isOnlyMissing,
            isCleanMissing: req.query.isCleanMissing,
        })
            .then(res.json.bind(res))
            .catch(next));

    router.get(paths.missing, auth(paths.missing), (req, res, next) =>
        Locale.find({ 'strings.text': { $in: [''] } })
            .exec()
            .then(res.send.bind(res))
            .catch(next));

    router.post(paths.missing, auth(paths.missing), (req, res, next) =>
        missing(Object.assign({}, req.body, req.query))
            .then(res.send.bind(res))
            .catch(next));


    // Admin features: get all locales
    router.get(paths.admin, auth(paths.admin), (req, res, next) => {
        let promise;
        const query = {};

        if (req.query.text) {
            query.strings = { $elemMatch: { text: req.query.text } };
        }

        if (req.query.type) {
            promise = LocaleTypes
                .find({ type: req.query.type })
                .lean()
                .limit(1)
                .then((types) => {
                    if (types.length) {
                        query.refs = types[0]._id;
                    }
                    return query;
                });
        } else {
            promise = Promise.resolve(query);
        }

        promise.then(_query => Locale.find(_query))
            .then(res.json.bind(res))
            .catch(next);
    });

    router.get(paths.types, auth(paths.types), (req, res, next) =>
        LocaleTypes.find({})
            .then(res.json.bind(res))
            .catch(next));

    // Create multiple locales at once
    router.post(paths.multi, auth(paths.multi), (req, res, next) => {
        const types = {};
        Promise.resolve()
            .then(() => {
                if (req.query.type && !types[req.query.type]) {
                    return getTypeDoc(req.query.type)
                        .then(typeDoc => (types[req.query.type] = typeDoc._id));
                }
                return Promise.resolve();
            })
            .then(() => req.body.map((locale) => {
                if (req.query.type &&
                    (!Array.isArray(locale.refs) ||
                    !locale.refs.includes(types[req.query.type].toString()))
                ) {
                    locale.refs = locale.refs || []; // eslint-disable-line no-param-reassign
                    locale.refs.push(types[req.query.type]);
                }
                return locale;
            }))
            .then(locales => Locale.collection.insert(locales, (err, doc) => {
                if (err) {
                    next(err);
                } else {
                    res.send(doc);
                }
            }));
    });

    // Admin features: put locales
    router.put(paths.multi, auth(paths.multi), (req, res, next) => {
        const promises = [];
        req.body.forEach((locale) => {
            promises.push(updateLocale(locale._id, locale));
        });
        Promise.all(promises)
            .then(res.send.bind(res))
            .catch(next);
    });

    // Admin features: create locale
    router.post(paths.root, auth(paths.root), (req, res, next) =>
        Locale.collection.insert(req.body, (err, doc) => {
            if (err) {
                next(err);
            } else {
                res.send(doc);
            }
        }));

    // Admin features: put locale
    router.put(paths.id, auth(paths.id), (req, res, next) => updateLocale(req.params._id, req.body)
        .then(res.send.bind(res))
        .catch(next));

    // Admin features: delete locale
    router.delete(paths.id, auth(paths.id), (req, res, next) =>
        Locale.findOneAndRemove({ _id: req.params._id })
            .exec()
            .then(res.send.bind(res))
            .catch(next));

    return router;
}
