import bodyParser from 'body-parser';
import { getAvailableLangs, Locale, LocaleTypes } from './i18n-mongo';
import { findByType, missing } from './locales';

const defaultPaths = {
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
        auth = (req, res, next) => next();
    } else {
        auth = (req, res, next) => opts.auth(req.path, req.method)(req, res, next);
    }

    router.use(bodyParser.json());

    // Get all languages
    router.get(paths.langs, auth, (req, res) =>
        getAvailableLangs()
            .then(res.json.bind(res))
            .catch(throwErr(req, res)));

    // Send locales ready for javascript
    router.get(paths.clientjs, auth, (req, res) =>
        findByType(req.query.type || 'client', req.query.lang || (req.cookies || {}).lang)
            .then((translations) => {
                const js = `var locales = ${JSON.stringify(translations)};`;
                res.setHeader('content-type', 'application/javascript');
                res.send(js);
            })
            .catch(throwErr(req, res)));

    router.get(paths.alljson, auth, (req, res) =>
        findByType(req.query.type || 'client', req.query.lang || (req.cookies || {}).lang)
            .then(res.json.bind(res))
            .catch(throwErr(req, res)));

    router.get(paths.missing, auth, (req, res) =>
        Locale.find({ 'strings.text': { $in: [''] } })
            .exec()
            .then(res.send.bind(res))
            .catch(throwErr(req, res)));

    router.post(paths.missing, auth, (req, res) =>
        missing(Object.assign({}, req.body, req.query))
            .then(res.send.bind(res))
            .catch(throwErr(req, res)));


    // Admin features: get all locales
    router.get(paths.admin, auth, (req, res) => {
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

    router.get(paths.types, auth, (req, res) =>
        LocaleTypes.find({})
            .then(res.json.bind(res))
            .catch(throwErr(req, res)));

    // Create multiple locales at once
    router.post(paths.multi, auth, (req, res) =>
        Locale.collection.insert(req.body, (err, doc) => {
            if (err) {
                throwErr(req, res)(err);
            } else {
                res.send(doc);
            }
        }));

    // Admin features: put locales
    router.put(paths.multi, auth, (req, res) => {
        const promises = [];
        req.body.forEach((locale) => {
            promises.push(updateLocale(locale._id, locale));
        });
        Promise.all(promises)
            .then(res.send.bind(res))
            .catch(throwErr(req, res));
    });

    // Admin features: create locale
    router.post(paths.root, auth, (req, res) =>
        Locale.collection.insert(req.body, (err, doc) => {
            if (err) {
                throwErr(req, res)(err);
            } else {
                res.send(doc);
            }
        }));

    // Admin features: put locale
    router.put(paths.id, auth, (req, res) => updateLocale(req.params._id, req.body)
        .then(res.send.bind(res))
        .catch(throwErr(req, res)));

    // Admin features: delete locale
    router.delete(paths.id, auth, (req, res) =>
        Locale.findOneAndRemove({ _id: req.params._id })
            .exec()
            .then(res.send.bind(res))
            .catch(throwErr(req, res)));

    return router;
}
