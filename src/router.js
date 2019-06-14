import bodyParser from 'body-parser';
import { Types } from 'mongoose';
import { getAvailableLangs, Locale, LocaleTypes } from './i18n-mongo';
import { findLocalesByType, getTypeDoc, missing } from './locales';

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
        .findOneAndUpdate({ _id }, { $set: locale }, { new: true, upsert: true })
        .lean().exec();
}

function adminLocales(req, res, next) {
    const type = req.query.type;
    Promise.resolve()
        .then(() => (type ? getTypeDoc(type).then(r => ([r])) : LocaleTypes.find()))
        .then(typesArr => typesArr.reduce((types, t) => {
            types.objId[t._id] = t.type; // eslint-disable-line no-param-reassign
            types.types[t.type] = t._id; // eslint-disable-line no-param-reassign
            return types;
        }, { types: {}, objId: {} }))
        .then(({ types, objId }) => req.body.reduce((work, locale) => {
            if (!Array.isArray(locale.refs)) {
                locale.refs = locale.refs || []; // eslint-disable-line no-param-reassign
            }

            // eslint-disable-next-line no-param-reassign
            locale.refs = locale.refs.reduce((refs, ref) => {
                if (objId[ref]) { // ref is an objectId
                    refs.push(new Types.ObjectId(ref));
                } else if (types[ref]) { // ref is a type string (ie. 'client')
                    refs.push(types[ref]);
                }
                return refs;
            }, []);

            if (type && locale.refs.indexOf(types[type]) < 0) {
                locale.refs.push(types[type]);
            }

            if (locale._id) {
                // eslint-disable-next-line no-param-reassign
                locale._id = new Types.ObjectId(locale._id);
                work.updates.push(locale);
            } else {
                work.inserts.push(locale);
            }
            return work;
        }, { updates: [], inserts: [] }))
        .then(({ updates, inserts }) => new Promise(resolve =>
            Locale.collection.insert(inserts, (err, doc) => {
                if (err) {
                    resolve({ updates, inserted: err });
                } else {
                    resolve({ updates, inserted: doc });
                }
            })))
        .then(({ updates, inserted }) =>
            Promise.all(updates.map(locale => updateLocale(locale._id, locale)))
                .then(updated => ({ inserted, updated })))
        .then(res.send.bind(res))
        .catch(next);
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
        findLocalesByType(req.query.type || 'client', req.query.lang || (req.cookies || {}).lang)
            .then((translations) => {
                const js = `var locales = ${JSON.stringify(translations)};`;
                res.setHeader('content-type', 'application/javascript');
                res.send(js);
            })
            .catch(next));

    router.get(paths.alljson, auth(paths.alljson), (req, res, next) =>
        findLocalesByType(req.query.type || 'client', req.query.lang || (req.cookies || {}).lang, {
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

    // Admin features: post/put locales
    // Create multiple locales at once
    router.post(paths.root, auth(paths.root), adminLocales);
    router.put(paths.multi, auth(paths.multi), adminLocales);
    // router.put(paths.root, auth(paths.root), adminLocales);

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
