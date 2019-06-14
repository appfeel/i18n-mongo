/* eslint-disable global-require */
import sinon from 'sinon';
import request from 'supertest';
import express from 'express';
import { expect } from 'chai';
import { resolve } from 'path';

import { drop, fixtures, TEST_URI } from './mongodriver';
import i18nMongo, { createRouter, Lang, Locale, setTranslation, t } from '../src';
import * as locales from '../src/locales';
import { cleanCache } from '../src/strCache';
import { languages } from './mongoMocks';

const collections = {
    i18nmongolangs: require('./dbmocks/languages'),
};
const logInfo = sinon.spy();
const logError = sinon.spy();
const logWarning = sinon.spy();
const sendMail = sinon.spy((message, cb) => cb(null, 'Ok'));

describe('router', () => {
    let app;
    let mw;

    before((done) => {
        mw = i18nMongo(TEST_URI, {
            logger: { info: logInfo, error: logError, warning: logWarning },
            email: {
                transport: {
                    sendMail,
                },
                from: 'me',
                to: 'me',
            },
            defaultLanguage: 'en',
        }, () => {
            drop()
                .then(() => fixtures(collections))
                .then(() => t('default 1', { lang: 'ca' }))
                .then(() => setTranslation('default 2', 'per defecte2', 'ca'))
                .then(() => done())
                .catch(done);
        });
    });

    beforeEach(() => {
        const i18nRouter = createRouter(new express.Router());
        app = express();
        app.use(mw);
        app.use('/lang', i18nRouter);
        cleanCache();
        logInfo.reset();
        logWarning.reset();
        logError.reset();
        sendMail.reset();
    });

    it('GET /lang', (done) => {
        request(app)
            .get('/lang/langs')
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect('set-cookie', /lang=en; Max-Age=[\d]+; Path=\/; Expires=/)
            .then((res) => {
                expect(res.body).to.be.an('array').lengthOf(3);
                res.body.forEach((lang, idx) => {
                    expect(lang.lang).to.equal(languages[idx].lang);
                    expect(lang.displayName).to.equal(languages[idx].displayName);
                });
            })
            .then(() => done())
            .catch(done);
    });

    it('GET /client.js (type default = client, language default = en)', (done) => {
        request(app)
            .get('/lang/client.js')
            .expect(200)
            .expect('Content-Type', /application\/javascript/)
            .expect('set-cookie', /lang=en; Max-Age=[\d]+; Path=\/; Expires=/)
            .then((res) => {
                expect(res.text).to.be.an('string').equal('var locales = {};');
            })
            .then(() => done())
            .catch(done);
    });

    it('GET /client.js?type=server (language default = en)', (done) => {
        request(app)
            .get('/lang/client.js?type=server')
            .expect(200)
            .expect('Content-Type', /application\/javascript/)
            .expect('set-cookie', /lang=en; Max-Age=[\d]+; Path=\/; Expires=/)
            .then((res) => {
                expect(res.text).to.be.an('string').equal('var locales = {"default 2":"","default 1":""};');
            })
            .then(() => done())
            .catch(done);
    });

    it('GET /client.js?type=server&lang=ca', (done) => {
        request(app)
            .get('/lang/client.js?type=server&lang=ca')
            .expect(200)
            .expect('Content-Type', /application\/javascript/)
            .expect('set-cookie', /lang=en; Max-Age=[\d]+; Path=\/; Expires=/)
            .then((res) => {
                expect(res.text).to.be.an('string').equal('var locales = {"default 2":"per defecte2","default 1":""};');
            })
            .then(() => done())
            .catch(done);
    });

    it('GET /all.json (type default = client, language default = en)', (done) => {
        request(app)
            .get('/lang/all.json')
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect('set-cookie', /lang=en; Max-Age=[\d]+; Path=\/; Expires=/)
            .then((res) => {
                expect(res.body).to.be.an('object').deep.equal({});
            })
            .then(() => done())
            .catch(done);
    });

    it('GET /all.json?type=server (language default = en)', (done) => {
        request(app)
            .get('/lang/all.json?type=server')
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect('set-cookie', /lang=en; Max-Age=[\d]+; Path=\/; Expires=/)
            .then((res) => {
                expect(res.body).to.be.an('object').deep.equal({ 'default 2': '', 'default 1': '' });
            })
            .then(() => done())
            .catch(done);
    });

    it('GET /all.json?type=server&lang=ca', (done) => {
        request(app)
            .get('/lang/all.json?type=server&lang=ca')
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect('set-cookie', /lang=en; Max-Age=[\d]+; Path=\/; Expires=/)
            .then((res) => {
                expect(res.body).to.be.an('object').deep.equal({ 'default 2': 'per defecte2', 'default 1': '' });
            })
            .then(() => done())
            .catch(done);
    });

    it('GET /missing', (done) => {
        request(app)
            .get('/lang/missing')
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect('set-cookie', /lang=en; Max-Age=[\d]+; Path=\/; Expires=/)
            .then((res) => {
                expect(res.body).to.be.an('array').lengthOf(1);
                const lDocs = res.body[0];
                expect(lDocs).to.be.an('object').all.keys(['_id', '__v', 'refs', 'strings']);
                expect(lDocs._id).to.be.an('string');
                expect(lDocs.refs).to.be.an('array').lengthOf(1);
                expect(lDocs.refs[0]).to.be.an('string');
                expect(lDocs.strings).to.be.an('array').lengthOf(2);
                expect(lDocs.strings).deep.equal([
                    { text: 'default 1', lang: '--' },
                    { text: '', lang: 'ca', extra: `then.then (${resolve(__dirname)}/router.js:40:29)` }]);
            })
            .then(() => done())
            .catch(done);
    });

    it('POST /missing body', (done) => {
        const waitForMissing = [];
        const originalMising = locales.missing;
        const missing = sinon.stub(locales, 'missing', (args) => {
            const promise = originalMising(args);
            waitForMissing.push(promise);
            return promise;
        });
        const finish = (err) => {
            missing.restore();
            done(err);
        };

        request(app)
            .post('/lang/missing')
            .set('Content-type', 'application/json')
            .send({ type: 'client', lang: 'fr', text: 'This is a missing text' })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then((res) => {
                sinon.assert.calledOnce(logInfo);
                sinon.assert.calledOnce(sendMail);
                sinon.assert.calledOnce(missing);
                expect(res.body).an('object').all.keys(['_id', '__v', 'refs', 'strings']);
                expect(res.body.strings).deep.equal([
                    { text: 'This is a missing text', lang: '--' },
                    { text: '', lang: 'fr' },
                ]);
                return Locale.find({ _id: res.body._id });
            })
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('GET /missing', (done) => {
        request(app)
            .get('/lang/missing')
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect('set-cookie', /lang=en; Max-Age=[\d]+; Path=\/; Expires=/)
            .then((res) => {
                expect(res.body).to.be.an('array').lengthOf(2);
                let lDocs = res.body[0];
                expect(lDocs).to.be.an('object').all.keys(['_id', '__v', 'refs', 'strings']);
                expect(lDocs._id).to.be.an('string');
                expect(lDocs.refs).to.be.an('array').lengthOf(1);
                expect(lDocs.refs[0]).to.be.an('string');
                expect(lDocs.strings).to.be.an('array').lengthOf(2);
                expect(lDocs.strings).deep.equal([
                    { text: 'default 1', lang: '--' },
                    { text: '', lang: 'ca', extra: `then.then (${resolve(__dirname)}/router.js:40:29)` }]);
                expect(lDocs).to.be.an('object').all.keys(['_id', '__v', 'refs', 'strings']);

                lDocs = res.body[1];
                expect(lDocs._id).to.be.an('string');
                expect(lDocs.refs).to.be.an('array').lengthOf(1);
                expect(lDocs.refs[0]).to.be.an('string');
                expect(lDocs.strings).to.be.an('array').lengthOf(2);
                expect(lDocs.strings).deep.equal([{ text: 'This is a missing text', lang: '--' }, { text: '', lang: 'fr' }]);
            })
            .then(() => done())
            .catch(done);
    });

    it('POST /missing?type=client&lang=de&text=This+is+a+missing+text', (done) => {
        const waitForMissing = [];
        const originalMising = locales.missing;
        const missing = sinon.stub(locales, 'missing', (args) => {
            const promise = originalMising(args);
            waitForMissing.push(promise);
            return promise;
        });
        const finish = (err) => {
            missing.restore();
            done(err);
        };

        request(app)
            .post('/lang/missing?type=client&lang=de&text=This+is+a+missing+text')
            .set('Content-type', 'application/json')
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then((res) => {
                sinon.assert.calledOnce(logInfo);
                sinon.assert.calledOnce(sendMail);
                sinon.assert.calledOnce(missing);
                expect(res.body).an('object').all.keys(['_id', '__v', 'refs', 'strings']);
                expect(res.body.strings).deep.equal([
                    { text: 'This is a missing text', lang: '--' },
                    { text: '', lang: 'fr' },
                    { text: '', lang: 'de' },
                ]);
                return Locale.find({ _id: res.body._id });
            })
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('POST /missing?type=server&lang=de&text=This+is+a+missing+text', (done) => {
        const waitForMissing = [];
        const originalMising = locales.missing;
        const missing = sinon.stub(locales, 'missing', (args) => {
            const promise = originalMising(args);
            waitForMissing.push(promise);
            return promise;
        });
        const finish = (err) => {
            missing.restore();
            done(err);
        };

        request(app)
            .post('/lang/missing?type=server&lang=de&text=This+is+a+missing+text')
            .set('Content-type', 'application/json')
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then((res) => {
                sinon.assert.calledOnce(logInfo);
                sinon.assert.calledOnce(sendMail);
                sinon.assert.calledOnce(missing);
                expect(res.body).an('object').all.keys(['_id', '__v', 'refs', 'strings']);
                expect(res.body.strings).deep.equal([
                    { text: 'This is a missing text', lang: '--' },
                    { text: '', lang: 'de' },
                ]);
                return Locale.find({ _id: res.body._id });
            })
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('GET /admin', (done) => {
        const waitForMissing = [];
        const originalMising = locales.missing;
        const missing = sinon.stub(locales, 'missing', (args) => {
            const promise = originalMising(args);
            waitForMissing.push(promise);
            return promise;
        });
        const finish = (err) => {
            missing.restore();
            done(err);
        };

        request(app)
            .get('/lang/admin')
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then((res) => {
                expect(res.body).an('array').lengthOf(4);
                const strings = res.body.map((itm) => {
                    expect(itm).an('object').all.keys(['_id', '__v', 'refs', 'strings']);
                    expect(itm.refs).an('array').lengthOf(1);
                    return itm.strings;
                });
                expect(strings).deep.equal([
                    [
                        { text: 'default 1', lang: '--' },
                        { text: '', lang: 'ca', extra: `then.then (${resolve(__dirname)}/router.js:40:29)` },
                    ],
                    [
                        { text: 'default 2', lang: '--' },
                        { text: 'per defecte2', lang: 'ca', extra: `then.then.then (${resolve(__dirname)}/router.js:41:29)` },
                    ],
                    [
                        { text: 'This is a missing text', lang: '--' },
                        { text: '', lang: 'fr' },
                        { lang: 'de', text: '' },
                    ],
                    [
                        { text: 'This is a missing text', lang: '--' },
                        { text: '', lang: 'de' },
                    ],
                ]);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('GET /admin?type=server', (done) => {
        const waitForMissing = [];
        const originalMising = locales.missing;
        const missing = sinon.stub(locales, 'missing', (args) => {
            const promise = originalMising(args);
            waitForMissing.push(promise);
            return promise;
        });
        const finish = (err) => {
            missing.restore();
            done(err);
        };

        request(app)
            .get('/lang/admin?type=server')
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then((res) => {
                expect(res.body).an('array').lengthOf(3);
                const strings = res.body.map((itm) => {
                    expect(itm).an('object').all.keys(['_id', '__v', 'refs', 'strings']);
                    expect(itm.refs).an('array').lengthOf(1);
                    return itm.strings;
                });

                expect(strings).deep.equal([
                    [
                        { text: 'default 1', lang: '--' },
                        { text: '', lang: 'ca', extra: `then.then (${resolve(__dirname)}/router.js:40:29)` },
                    ],
                    [
                        { text: 'default 2', lang: '--' },
                        { text: 'per defecte2', lang: 'ca', extra: `then.then.then (${resolve(__dirname)}/router.js:41:29)` },
                    ],
                    [
                        { text: 'This is a missing text', lang: '--' },
                        { text: '', lang: 'de' },
                    ],
                ]);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('GET /admin?type=none', (done) => {
        const waitForMissing = [];
        const originalMising = locales.missing;
        const missing = sinon.stub(locales, 'missing', (args) => {
            const promise = originalMising(args);
            waitForMissing.push(promise);
            return promise;
        });
        const finish = (err) => {
            missing.restore();
            done(err);
        };

        request(app)
            .get('/lang/admin?type=none')
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then((res) => {
                expect(res.body).an('array').lengthOf(4);
                const strings = res.body.map((itm) => {
                    expect(itm).an('object').all.keys(['_id', '__v', 'refs', 'strings']);
                    expect(itm.refs).an('array').lengthOf(1);
                    return itm.strings;
                });

                expect(strings).deep.equal([
                    [
                        { text: 'default 1', lang: '--' },
                        { text: '', lang: 'ca', extra: `then.then (${resolve(__dirname)}/router.js:40:29)` },
                    ],
                    [
                        { text: 'default 2', lang: '--' },
                        { text: 'per defecte2', lang: 'ca', extra: `then.then.then (${resolve(__dirname)}/router.js:41:29)` },
                    ],
                    [
                        { text: 'This is a missing text', lang: '--' },
                        { text: '', lang: 'fr' },
                        { lang: 'de', text: '' },
                    ],
                    [
                        { text: 'This is a missing text', lang: '--' },
                        { text: '', lang: 'de' },
                    ],
                ]);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('GET /admin?text=This+is+a+missing+text', (done) => {
        const waitForMissing = [];
        const originalMising = locales.missing;
        const missing = sinon.stub(locales, 'missing', (args) => {
            const promise = originalMising(args);
            waitForMissing.push(promise);
            return promise;
        });
        const finish = (err) => {
            missing.restore();
            done(err);
        };

        request(app)
            .get('/lang/admin?text=This+is+a+missing+text')
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then((res) => {
                expect(res.body).an('array').lengthOf(2);
                const strings = res.body.map((itm) => {
                    expect(itm).an('object').all.keys(['_id', '__v', 'refs', 'strings']);
                    expect(itm.refs).an('array').lengthOf(1);
                    return itm.strings;
                });
                expect(strings).deep.equal([
                    [
                        { text: 'This is a missing text', lang: '--' },
                        { text: '', lang: 'fr' },
                        { text: '', lang: 'de' },
                    ],
                    [
                        { text: 'This is a missing text', lang: '--' },
                        { text: '', lang: 'de' },
                    ],
                ]);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('GET /types', (done) => {
        request(app)
            .get('/lang/types')
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect('set-cookie', /lang=en; Max-Age=[\d]+; Path=\/; Expires=/)
            .then((res) => {
                expect(res.body).to.be.an('array').lengthOf(2);
                const types = res.body.map((itm) => {
                    expect(itm).an('object').all.keys(['_id', 'type']);
                    return itm.type;
                });
                expect(types.sort()).deep.equal(['client', 'server']);
            })
            .then(() => done())
            .catch(done);
    });

    it('POST /?type=client', (done) => {
        const waitForMissing = [];
        const originalMising = locales.missing;
        const missing = sinon.stub(locales, 'missing', (args) => {
            const promise = originalMising(args);
            waitForMissing.push(promise);
            return promise;
        });
        const finish = (err) => {
            missing.restore();
            done(err);
        };

        request(app)
            .post('/lang/?type=client')
            .set('Content-type', 'application/json')
            .send([
                { strings: [{ lang: 'fr', text: 'This is a missing text' }], refs: [] },
                { strings: [{ lang: 'fr', text: 'Another missing text' }], refs: [] },
            ])
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then((res) => {
                sinon.assert.notCalled(logInfo);
                sinon.assert.notCalled(sendMail);
                sinon.assert.notCalled(missing);
                expect(res.body).an('object').all.keys('inserted', 'updated');
                expect(res.body.inserted).an('object').all.keys('result', 'ops', 'insertedCount', 'insertedIds');
                expect(res.body.inserted.result).deep.equal({ ok: 1, n: 2 });
                expect(res.body.inserted.ops).an('array').lengthOf(2);
                expect(res.body.inserted.insertedCount).an('number').equal(2);
                expect(res.body.inserted.insertedIds).an('object').all.keys('0', '1');

                const strings = res.body.inserted.ops.map((itm, i) => {
                    expect(itm._id.toString()).equal(res.body.inserted.insertedIds[i].toString());
                    expect(itm.refs).an('array').lengthOf(1);
                    return itm.strings;
                });

                expect(strings).deep.equal([
                    [{ lang: 'fr', text: 'This is a missing text' }],
                    [{ lang: 'fr', text: 'Another missing text' }],
                ]);
                expect(res.body.updated).an('array').lengthOf(0);
            })
            .then(() => finish())
            .catch(finish);
    });


    let lastInsert;
    it('POST /', (done) => {
        const waitForMissing = [];
        const originalMising = locales.missing;
        const missing = sinon.stub(locales, 'missing', (args) => {
            const promise = originalMising(args);
            waitForMissing.push(promise);
            return promise;
        });
        const finish = (err) => {
            missing.restore();
            done(err);
        };

        request(app)
            .post('/lang/')
            .set('Content-type', 'application/json')
            .send([
                { strings: [{ lang: 'fr', text: 'This is a missing text' }], refs: [] },
                { strings: [{ lang: 'fr', text: 'Another missing text' }], refs: [] },
            ])
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then((res) => {
                sinon.assert.notCalled(logInfo);
                sinon.assert.notCalled(sendMail);
                sinon.assert.notCalled(missing);
                expect(res.body).an('object').all.keys('inserted', 'updated');
                expect(res.body.inserted).an('object').all.keys('result', 'ops', 'insertedCount', 'insertedIds');
                expect(res.body.inserted.result).deep.equal({ ok: 1, n: 2 });
                expect(res.body.inserted.ops).an('array').lengthOf(2);
                expect(res.body.inserted.insertedCount).an('number').equal(2);
                expect(res.body.inserted.insertedIds).an('object').all.keys('0', '1');
                lastInsert = res.body.inserted.ops;

                const strings = res.body.inserted.ops.map((itm, i) => {
                    expect(itm._id.toString()).equal(res.body.inserted.insertedIds[i].toString());
                    return itm.strings;
                });

                expect(strings).deep.equal([
                    [{ lang: 'fr', text: 'This is a missing text' }],
                    [{ lang: 'fr', text: 'Another missing text' }],
                ]);
                expect(res.body.updated).an('array').lengthOf(0);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('PUT /multi', (done) => {
        const waitForMissing = [];
        const originalMising = locales.missing;
        const missing = sinon.stub(locales, 'missing', (args) => {
            const promise = originalMising(args);
            waitForMissing.push(promise);
            return promise;
        });
        const finish = (err) => {
            missing.restore();
            done(err);
        };

        lastInsert[0].strings[0].text = 'Modified text';
        lastInsert[1].strings[0].text = 'Another modified text';

        request(app)
            .put('/lang/multi')
            .set('Content-type', 'application/json')
            .send(lastInsert)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then((res) => {
                sinon.assert.notCalled(logInfo);
                sinon.assert.notCalled(sendMail);
                sinon.assert.notCalled(missing);

                expect(res.body).an('object').all.keys('inserted', 'updated');

                expect(res.body).an('object').all.keys('inserted', 'updated');
                expect(res.body.inserted).an('object').all.keys('name', 'driver');
                expect(res.body.inserted.name).equal('MongoError');
                // expect(res.body.inserted.message).equal('Invalid Operation, no operations specified');
                expect(res.body.inserted.driver).equal(true);

                expect(res.body.updated).an('array').lengthOf(2);
                expect(res.body.updated).deep.equal(lastInsert);
                return Locale.find({ _id: lastInsert[0]._id }).lean().exec();
            })
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
                expect(docs[0].strings).deep.equal(lastInsert[0].strings);
                expect(docs[0].refs).deep.equal(lastInsert[0].refs);

                return Locale.find({ _id: lastInsert[1]._id }).lean().exec();
            })
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
                expect(docs[0].strings).deep.equal(lastInsert[1].strings);
                expect(docs[0].refs).deep.equal(lastInsert[1].refs);
            })
            .then(() => finish())
            .catch(finish);
    });

    // it('POST /', (done) => {
    //     const waitForMissing = [];
    //     const originalMising = locales.missing;
    //     const missing = sinon.stub(locales, 'missing', (args) => {
    //         const promise = originalMising(args);
    //         waitForMissing.push(promise);
    //         return promise;
    //     });
    //     const finish = (err) => {
    //         missing.restore();
    //         done(err);
    //     };

    //     request(app)
    //         .post('/lang/')
    //         .set('Content-type', 'application/json')
    //         .send({ strings: [{ lang: 'fr', text: 'POST / This is a missing text' }], refs: [] })
    //         .expect(200)
    //         .expect('Content-Type', /application\/json/)
    //         .then((res) => {
    //             sinon.assert.notCalled(logInfo);
    //             sinon.assert.notCalled(sendMail);
    //             sinon.assert.notCalled(missing);
    //             expect(res.body).an('object').all.keys('result', 'ops', 'insertedCount', 'insertedIds');
    //             expect(res.body.result).deep.equal({ ok: 1, n: 1 });
    //             expect(res.body.ops).an('array').lengthOf(1);
    //             expect(res.body.insertedCount).an('number').equal(1);
    //             expect(res.body.insertedIds).an('array').lengthOf(1);
    //             lastInsert = res.body.ops;

    //             const strings = res.body.ops.map((itm, i) => {
    //                 expect(itm._id.toString()).equal(res.body.insertedIds[i].toString());
    //                 return itm.strings;
    //             });

    //             expect(strings).deep.equal([
    //                 [{ lang: 'fr', text: 'POST / This is a missing text' }],
    //             ]);
    //         })
    //         .then(() => finish())
    //         .catch(finish);
    // });

    it('PUT /', (done) => {
        const waitForMissing = [];
        const originalMising = locales.missing;
        const missing = sinon.stub(locales, 'missing', (args) => {
            const promise = originalMising(args);
            waitForMissing.push(promise);
            return promise;
        });
        const finish = (err) => {
            missing.restore();
            done(err);
        };

        lastInsert[0].strings[0].text = 'PUT / Modified text';

        request(app)
            .put(`/lang/${lastInsert[0]._id}`)
            .set('Content-type', 'application/json')
            .send(lastInsert[0])
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then((res) => {
                sinon.assert.notCalled(logInfo);
                sinon.assert.notCalled(sendMail);
                sinon.assert.notCalled(missing);
                expect(res.body).an('object').deep.equal(lastInsert[0]);
                return Locale.find({ _id: lastInsert[0]._id }).lean().exec();
            })
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
                expect(docs[0].strings).deep.equal(lastInsert[0].strings);
                expect(docs[0].refs).deep.equal(lastInsert[0].refs);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('DELETE /:id', (done) => {
        const waitForMissing = [];
        const originalMising = locales.missing;
        const missing = sinon.stub(locales, 'missing', (args) => {
            const promise = originalMising(args);
            waitForMissing.push(promise);
            return promise;
        });
        const finish = (err) => {
            missing.restore();
            done(err);
        };

        request(app)
            .delete(`/lang/${lastInsert[0]._id}`)
            .set('Content-type', 'application/json')
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then((res) => {
                sinon.assert.notCalled(logInfo);
                sinon.assert.notCalled(sendMail);
                sinon.assert.notCalled(missing);
                expect(res.body).an('object').deep.equal(lastInsert[0]);
                return Locale.find({ _id: lastInsert[0]._id }).lean().exec();
            })
            .then((docs) => {
                expect(docs).an('array').lengthOf(0);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('GET /lang throw error', (done) => {
        const thrownErr = new Error('Super error');
        const langFind = sinon.stub(Lang, 'find', () => ({
            sort: () => ({
                exec: () => Promise.reject(thrownErr),
            }),
        }));
        const finish = (err) => {
            langFind.restore();
            done(err);
        };
        // eslint-disable-next-line no-unused-vars
        app.use((err, req, res, next) => {
            expect(err).deep.equal(thrownErr);
            res.status(500).json({ error: err.message });
        });
        request(app)
            .get('/lang/langs')
            .expect(500)
            .expect('set-cookie', /lang=en; Max-Age=[\d]+; Path=\/; Expires=/)
            .then((res) => {
                expect(res.body).an('object').all.keys(['error']);
                expect(res.body.error).equal(thrownErr.message);
                expect(res.error.message).not.equal('');
                finish();
            })
            .catch(finish);
    });

    it('POST / empty array returns error', (done) => {
        const waitForMissing = [];
        const originalMising = locales.missing;
        const missing = sinon.stub(locales, 'missing', (args) => {
            const promise = originalMising(args);
            waitForMissing.push(promise);
            return promise;
        });
        const finish = (err) => {
            missing.restore();
            done(err);
        };
        request(app)
            .post('/lang')
            .set('Content-type', 'application/json')
            .send([])
            .expect(200)
            .then((res) => {
                sinon.assert.notCalled(logInfo);
                sinon.assert.notCalled(sendMail);
                sinon.assert.notCalled(missing);
                expect(res.body).an('object').all.keys('inserted', 'updated');
                expect(res.body.inserted).an('object').all.keys('name', 'driver');
                expect(res.body.inserted.name).equal('MongoError');
                // expect(res.body.inserted.message).equal('Invalid Operation, no operations specified');
                expect(res.body.inserted.driver).equal(true);
                expect(res.body.updated).an('array').lengthOf(0);
                finish();
            })
            .catch(finish);
    });

    it('POST / throw error', (done) => {
        const waitForMissing = [];
        const originalMising = locales.missing;
        const missing = sinon.stub(locales, 'missing', (args) => {
            const promise = originalMising(args);
            waitForMissing.push(promise);
            return promise;
        });
        const finish = (err) => {
            missing.restore();
            done(err);
        };
        request(app)
            .post('/lang')
            .set('Content-type', 'application/json')
            .send([])
            .expect(200)
            .then((res) => {
                sinon.assert.notCalled(logInfo);
                sinon.assert.notCalled(sendMail);
                sinon.assert.notCalled(missing);
                expect(res.body).an('object').all.keys('inserted', 'updated');
                expect(res.body.inserted).an('object').all.keys('name', 'driver');
                expect(res.body.inserted.name).equal('MongoError');
                // expect(res.body.inserted.message).equal('Invalid Operation, no operations specified');
                expect(res.body.inserted.driver).equal(true);
                expect(res.body.updated).an('array').lengthOf(0);
            })
            .then(() => finish())
            .catch(finish);
    });
});

describe('router auth', () => {
    let mw;

    before((done) => {
        mw = i18nMongo(TEST_URI, {
            logger: { info: logInfo, error: logError, warning: logWarning },
            email: {
                transport: {
                    sendMail,
                },
                from: 'me',
                to: 'me',
            },
            defaultLanguage: 'en',
        }, () => {
            drop()
                .then(() => fixtures(collections))
                .then(() => t('default 1', { lang: 'ca' }))
                .then(() => setTranslation('default 2', 'per defecte2', 'ca'))
                .then(() => done())
                .catch(done);
        });
    });

    beforeEach(() => {
        cleanCache();
        logInfo.reset();
        logWarning.reset();
        logError.reset();
        sendMail.reset();
    });

    let lastInsert;
    it('POST / authorized', (done) => {
        const app = express();
        const waitForMissing = [];
        const originalMising = locales.missing;
        const missing = sinon.stub(locales, 'missing', (args) => {
            const promise = originalMising(args);
            waitForMissing.push(promise);
            return promise;
        });
        const finish = (err) => {
            missing.restore();
            done(err);
        };
        const router = new express.Router();
        const auth = sinon.spy(() => (req, res, next) => next());
        const nlRouter = createRouter(router, { auth });
        app.use(mw);
        app.use('/lang', nlRouter);

        request(app)
            .post('/lang/')
            .set('Content-type', 'application/json')
            .send([{ strings: [{ lang: 'fr', text: 'POST / This is a missing text (auth)' }], refs: [] }])
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then((res) => {
                sinon.assert.notCalled(logInfo);
                sinon.assert.notCalled(sendMail);
                sinon.assert.notCalled(missing);
                sinon.assert.calledOnce(auth);
                sinon.assert.calledWith(auth, '/', 'POST');
                expect(res.body).an('object').all.keys('inserted', 'updated');
                expect(res.body.inserted).an('object').all.keys('result', 'ops', 'insertedCount', 'insertedIds');
                expect(res.body.inserted.result).deep.equal({ ok: 1, n: 1 });
                expect(res.body.inserted.ops).an('array').lengthOf(1);
                expect(res.body.inserted.insertedCount).an('number').equal(1);
                expect(res.body.inserted.insertedIds).an('object').all.keys('0');
                lastInsert = res.body.inserted.ops;

                const strings = res.body.inserted.ops.map((itm, i) => {
                    expect(itm._id.toString()).equal(res.body.inserted.insertedIds[i].toString());
                    return itm.strings;
                });

                expect(strings).deep.equal([
                    [{ lang: 'fr', text: 'POST / This is a missing text (auth)' }],
                ]);

                expect(res.body.updated).an('array').lengthOf(0);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('PUT / unauthorized', (done) => {
        const app = express();
        const waitForMissing = [];
        const originalMising = locales.missing;
        const missing = sinon.stub(locales, 'missing', (args) => {
            const promise = originalMising(args);
            waitForMissing.push(promise);
            return promise;
        });
        const finish = (err) => {
            missing.restore();
            done(err);
        };
        const router = new express.Router();
        const auth = sinon.spy(() => (req, res) => res.status(401).end());
        const nlRouter = createRouter(router, { auth });
        app.use(mw);
        app.use('/lang', nlRouter);

        lastInsert[0].strings[0].text = 'PUT / Unauthorized';

        request(app)
            .put(`/lang/${lastInsert[0]._id}`)
            .set('Content-type', 'application/json')
            .send(lastInsert[0])
            .expect(401)
            .then((res) => {
                sinon.assert.notCalled(logInfo);
                sinon.assert.notCalled(sendMail);
                sinon.assert.notCalled(missing);
                sinon.assert.calledOnce(auth);
                sinon.assert.calledWith(auth, '/:_id', 'PUT');
                expect(res.body).an('object').deep.equal({});
                return Locale.find({ _id: lastInsert[0]._id }).lean().exec();
            })
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
                lastInsert[0].strings[0].text = 'POST / This is a missing text (auth)';
                expect(docs[0].strings).deep.equal(lastInsert[0].strings);
                expect(docs[0].refs).deep.equal(lastInsert[0].refs);
            })
            .then(() => finish())
            .catch(finish);
    });
});
