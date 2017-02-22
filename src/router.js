import bodyParser from 'body-parser';
import { getAvailableLangs, Locale, LocaleTypes } from './i18n-mongo';
import { findByType, missing } from './locales';

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
    const throwErr = opts.sendErr ||
        ((req, res) => err => res.status(500).send({ error: err.toString() }));
    const paths = Object.assign({}, defaultPaths, opts.paths || {});
    let auth;

    if (!opts.auth) {
        auth = () => (req, res, next) => next();
    } else {
        auth = path => (req, res, next) => opts.auth(path, req.method)(req, res, next);
    }

    router.use(bodyParser.json());

    // Get all languages
    router.get(paths.langs, auth(paths.langs), (req, res) =>
        getAvailableLangs()
            .then(res.json.bind(res))
            .catch(throwErr(req, res)));

    // Send locales ready for javascript
    router.get(paths.clientjs, auth(paths.clientjs), (req, res) =>
        findByType(req.query.type || 'client', req.query.lang || (req.cookies || {}).lang)
            .then((translations) => {
                const js = `var locales = ${JSON.stringify(translations)};`;
                res.setHeader('content-type', 'application/javascript');
                res.send(js);
            })
            .catch(throwErr(req, res)));

    router.get(paths.alljson, auth(paths.alljson), (req, res) =>
        findByType(req.query.type || 'client', req.query.lang || (req.cookies || {}).lang)
            .then(res.json.bind(res))
            .catch(throwErr(req, res)));

    router.get(paths.missing, auth(paths.missing), (req, res) =>
        Locale.find({ 'strings.text': { $in: [''] } })
            .exec()
            .then(res.send.bind(res))
            .catch(throwErr(req, res)));

    router.post(paths.missing, auth(paths.missing), (req, res) =>
        missing(Object.assign({}, req.body, req.query))
            .then(res.send.bind(res))
            .catch(throwErr(req, res)));


    // Admin features: get all locales
    router.get(paths.admin, auth(paths.admin), (req, res) => {
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
            .catch(throwErr(req, res));
    });

    router.get(paths.types, auth(paths.types), (req, res) =>
        LocaleTypes.find({})
            .then(res.json.bind(res))
            .catch(throwErr(req, res)));

    // Create multiple locales at once
    router.post(paths.multi, auth(paths.multi), (req, res) =>
        Locale.collection.insert(req.body, (err, doc) => {
            if (err) {
                throwErr(req, res)(err);
            } else {
                res.send(doc);
            }
        }));

    // Admin features: put locales
    router.put(paths.multi, auth(paths.multi), (req, res) => {
        const promises = [];
        req.body.forEach((locale) => {
            promises.push(updateLocale(locale._id, locale));
        });
        Promise.all(promises)
            .then(res.send.bind(res))
            .catch(throwErr(req, res));
    });

    // Admin features: create locale
    router.post(paths.root, auth(paths.root), (req, res) =>
        Locale.collection.insert(req.body, (err, doc) => {
            if (err) {
                throwErr(req, res)(err);
            } else {
                res.send(doc);
            }
        }));

    // Admin features: put locale
    router.put(paths.id, auth(paths.id), (req, res) => updateLocale(req.params._id, req.body)
        .then(res.send.bind(res))
        .catch(throwErr(req, res)));

    // Admin features: delete locale
    router.delete(paths.id, auth(paths.id), (req, res) =>
        Locale.findOneAndRemove({ _id: req.params._id })
            .exec()
            .then(res.send.bind(res))
            .catch(throwErr(req, res)));

    return router;
}
