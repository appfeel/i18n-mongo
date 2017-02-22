i18n-mongo
==========

This README document is under construction

![License: EUPL v1.1](http://img.shields.io/badge/License-EUPL_v1.1-blue.svg?style=flat)
[![NPM version](http://img.shields.io/npm/v/i18n-mongo.svg?style=flat)](https://npmjs.org/package/i18n-mongo)
[![Downloads](http://img.shields.io/npm/dm/i18n-mongo.svg?style=flat)](https://npmjs.org/package/i18n-mongo)
[![Build Status](https://travis-ci.org/appfeel/i18n-mongo.svg?branch=master)](https://travis-ci.org/appfeel/i18n-mongo)
[![Coverage Status](https://coveralls.io/repos/github/appfeel/i18n-mongo/badge.svg)](https://coveralls.io/github/appfeel/i18n-mongo)

## Install me

```
$ npm i i18n-mongo --save
```

## How to use it

To create a translatable schema, you can use `localizableModel`:

**server.js**

```js
import express from 'express';
import http from 'http';
import { i18nMongo } from 'i18n-mongo';

const mongodbUrl = 'mongodb://localhost:27017/my-db';
const user = '';
const pass = '';

mongoose.connect(mongodbUrl, { user, pass }, (err) => {
    mongoose.Promise = q.Promise;
    const app = express();

    app.use(i18nMongo());
    http.createServer(app).listen(3000);
});
```

**mycollection.js**:

```js
import { localizableModel, Localized } from 'i18n-mongo';

const Schema = mongoose.Schema;
const mycollection = new Schema({
    translatableString: Localized
    someObject: {
        translatableObjString: Localized
    }
});

export const MyModel = localizableModel('mycollection', mycollection);
```

**router.js**:

```js
import express from 'express';
import mongoose from 'mongoose';
import { createRouter } from 'i18n-mongo';
import { MyModel } from './mycollection';

const app = express();
const mw = i18nMongo({
    logger: console, // Optional
    email: { // Optional
        transport: nodemailer.createTransport(...),
        from: 'me@appfeel.com',
        to: 'me@whoiam.com',
    },
    defaultLanguage: 'en', // Optional
}, (err) => {
    console.log('Available languages loaded and i18n is ready to be used');
});
app.use(mw);


const router = createRouter(new express.Router(), { auth });
app.use('/lang', router);


router.get('/mycollection', (req, res) => {
    MyModel.findLocalized({}, req.lang)
        .then(res.json.bind(res))
        .catch(err => res.status(500).send(err));
});

router.get('/mycollection/:_id', (req, res) => {
    MyModel.findLocalized({ _id: req.params._id }, req.lang)
        .then(docs => ((docs && docs.length) ? res.json(doc[0]) : res.status(404).end())
        .catch(err => res.status(500).send(err));
});

router.post('/mycollection', async (req, res) => {
    MyModel.saveLocalized(req.body)
        .then((savedDoc) => {
            const uri = `/mycollection/${savedDoc._id}`;
            res.setHeader('Location', uri); // res.location(uri);
            res.status(201).send(uri);
        })
        .catch(err => res.status(500).send(err));
});

router.put('/mycollection/:_id', async (req, res) => {
    MyModel.saveLocalized(req.body, req.params._id)
        .then(() => res.status(204).end())
        .catch(err => res.status(500).send(err));
});

router.delete('/mycollection/:_id', async (req, res) => {
    MyModel.findOne({ _id: req.params._id }).exec()
        then((doc) => {
            if (doc) {
                doc.remove();
                res.status(204).end()
            } else {
                res.status(404).end()
            }
        })
        .catch(err => res.status(500).send(err));
});

router.get('/admin/mycollection', async (req, res) => {
    MyModel.findLocalized({}, '')
        .then(res.json.bind(res))
        .catch(err => res.status(500).send(err));
});
```

When requesting `GET /mycollection/IDHERE?lang=en` it will return the collection populated:

```json
{
    "translatableString": "The value for 'en' language",
    "someObject": {
        "translatableObjString": "Other string for 'en' language"
    }
}
```

When requesting `GET /admin/mycollection?lang=en`, the language will be ignored (as defined in router example) and it will return all languages:

```json
{
    "translatableString": {
        "en": "The value for 'en' language",
        "ca": "El valor traduït al 'ca'"
    },
    "someObject": {
        "translatableObjString": {
            "en": "Other string for 'en' language",
            "ca": "Una altra string en 'ca'",
    }
}
```

