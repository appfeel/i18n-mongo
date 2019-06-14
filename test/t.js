/* eslint-disable no-unused-expressions */
import sinon from 'sinon';
import { expect } from 'chai';
import handlebars from 'handlebars';
import { resolve } from 'path';

import i18nMongo, { DefaultLanguage, initLanguages, Lang, Locale, LocaleTypes, t, setTranslation } from '../src';
import * as locales from '../src/locales';
import { cleanCache } from '../src/strCache';
import { TEST_URI } from './mongodriver';

function testDbLocale(text, type, lang, isShouldExist = true) {
    return Locale.aggregate([
        { $match: { 'strings.text': text } },
        {
            $project: {
                strings: {
                    $filter: {
                        input: '$strings',
                        as: 'string',
                        cond: { $or: [{ $eq: ['$$string.lang', lang] }, { $eq: ['$$string.lang', '--'] }] },
                    },
                },
                refs: 1,
            },
        },
    ]).exec()
        .then((localesData) => {
            // console.log(JSON.stringify(localesData, undefined, 4));
            // [
            //     {
            //         "_id": "58a4272d1d04990cf3e22c8c",
            //         "strings": [
            //             {
            //                 "text": "Special locale with no type",
            //                 "lang": "--"
            //             },
            //             {
            //                 "text": "",
            //                 "lang": "ca",
            //                 "extra": "t"
            //             }
            //         ]
            //     }
            // ]
            expect(localesData).to.be.an.array;
            if (isShouldExist) {
                expect(localesData.length).to.equal(1);
                expect(localesData[0]).to.have.all.keys(['_id', 'strings', 'refs']);
                expect(localesData[0].strings).to.be.an.array;
                expect(localesData[0].strings.length).to.equal(2);
                expect(localesData[0].strings[0]).to.have.all.keys(['text', 'lang']);
                expect(localesData[0].strings[1]).to.have.all.keys(['text', 'lang', 'extra']);
                expect(localesData[0].strings[0].text).to.equal(text);
                expect(localesData[0].strings[1]).to.have.all.keys(['text', 'lang', 'extra']);
                expect(localesData[0].refs).to.be.an.array;
                expect(localesData[0].refs.length).to.equal(1);
                expect(localesData[0].refs[0]).to.be.an.string;

                return LocaleTypes.find({ type }).lean().exec()
                    .then((localeTypesData) => {
                        // console.log(JSON.stringify(localeTypesData, undefined, 4));
                        // [
                        //     {
                        //         "_id": "58a42d87958c055346062d5b",
                        //         "type": "server"
                        //     }
                        // ]
                        expect(localeTypesData).to.be.an.array;
                        expect(localeTypesData.length).to.equal(1);
                        expect(localeTypesData[0]).to.have.all.keys(['_id', 'type']);
                        expect(localeTypesData[0]._id.toString())
                            .to.equal(localesData[0].refs[0].toString());
                        expect(localeTypesData[0].type).to.equal(type);
                        return true;
                    });
            }

            expect(localesData).to.deep.equal([]);
            return Promise.resolve(true);
        });
}

describe('t', () => {
    const lang = 'ca';
    const type = 'myType';
    const logInfo = sinon.spy();
    const logError = sinon.spy();
    const logWarning = sinon.spy();
    const sendMail = sinon.spy((message, cb) => cb(null, 'Ok'));
    let createLanguage;

    before(() => {
        i18nMongo(TEST_URI, {
            logger: { info: logInfo, error: logError, warning: logWarning },
            email: {
                transport: {
                    sendMail,
                },
                from: 'me',
                to: 'me',
            },
            defaultLanguage: 'en',
        });
        createLanguage = sinon.spy(Lang, 'findOneAndUpdate');
    });

    after(() => {
        createLanguage.restore();
    });

    beforeEach((done) => {
        cleanCache();
        logInfo.reset();
        logWarning.reset();
        logError.reset();
        sendMail.reset();
        createLanguage.reset();
        initLanguages()
            .then(() => done())
            .catch(done);
    });

    it('Remove every string in locales, localetypes and langs', (done) => {
        Locale.find().exec()
            .then(docs => docs.map(doc => doc.remove()))
            .then(promises => Promise.all(promises))
            .then(() => Locale.find().exec())
            .then(docs => expect(docs).to.deep.equal([]))
            .then(() => LocaleTypes.find().exec())
            .then(docs => docs.map(doc => doc.remove()))
            .then(promises => Promise.all(promises))
            .then(() => LocaleTypes.find().exec())
            .then(docs => expect(docs).to.deep.equal([]))
            .then(() => Lang.find().exec())
            .then(docs => docs.map(doc => doc.remove()))
            .then(promises => Promise.all(promises))
            .then(() => Lang.find().exec())
            .then(docs => expect(docs).to.deep.equal([]))
            .then(() => done())
            .catch(done);
    });

    it('Insert new locale in db and look for it', (done) => {
        const waitForMissing = [];
        const locTxt = 'New locale';
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
        t(locTxt, { lang, type })
            .then((translation) => {
                expect(translation).to.be.equal(locTxt);
                sinon.assert.calledOnce(missing);
                sinon.assert.calledWithExactly(missing, {
                    type,
                    lang,
                    text: locTxt,
                    extra: `Context.done (${resolve(__dirname)}/t.js:157:9)`,
                });
                sinon.assert.calledOnce(createLanguage);
                sinon.assert.calledWithExactly(createLanguage,
                    { lang },
                    { lang, displayName: '' },
                    { new: true, upsert: true });
                missing.reset();
                // We must wait for missing to finish: it will insert the locale in db
                return Promise.all(waitForMissing);
            })
            .then(() => {
                sinon.assert.notCalled(logError);
                sinon.assert.calledOnce(logInfo);
                sinon.assert.calledWithExactly(logInfo, `Inserted new translation for "${locTxt}" - "${lang}"`);
                sinon.assert.calledOnce(sendMail);
                sinon.assert.calledWithMatch(sendMail, {
                    from: 'me',
                    headers: { 'X-Laziness-level': 1000 },
                    // eslint-disable-next-line max-len
                    html: `Missing translation for <strong>${locTxt}</strong><br>Type: ${type}<br>At: <a href="Context.done (${resolve(__dirname)}/t.js:157:9)">Context.done (${resolve(__dirname)}/t.js:157:9)</a><br>Language: ${lang}<br><br>Empty translation has been automatically added, please review them.`,
                    subject: `Missing translation for "${locTxt}"`,
                    text: `Missing translation for "${locTxt}"\nType: ${type}\nAt: Context.done (${resolve(__dirname)}/t.js:157:9)\nLanguage: ${lang}`,
                    to: 'me',
                });

                sendMail.reset();
                logError.reset();
                logInfo.reset();
                // This call will pass through the cache
                return t(locTxt, { lang, type });
            })
            .then((translation) => {
                expect(translation).to.be.equal(locTxt);
                sinon.assert.notCalled(missing);
                // So we clean cache here and try to look for the locale in db
                cleanCache();
                return t(locTxt, { lang, type });
            })
            .then((translation) => {
                expect(translation).to.be.equal(locTxt);
                sinon.assert.notCalled(missing);
                sinon.assert.calledOnce(logWarning);
                sinon.assert.calledWithExactly(logWarning, `Still missing translation for "${locTxt}" (${lang})`);
                return testDbLocale(locTxt, type, lang);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('Default type is server', (done) => {
        const waitForMissing = [];
        const locTxt = 'Special locale with no type';
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
        t(locTxt, { lang })
            .then((translation) => {
                expect(translation).to.be.equal(locTxt);
                sinon.assert.calledOnce(missing);
                sinon.assert.calledWithExactly(missing, {
                    type: 'server',
                    text: locTxt,
                    lang,
                    extra: `Context.done (${resolve(__dirname)}/t.js:228:9)`,
                });
                missing.reset();
                // We must wait for missing to finish: it will insert the locale in db
                return Promise.all(waitForMissing);
            })
            .then(() => t(locTxt, { lang }))
            .then((translation) => {
                expect(translation).to.be.equal(locTxt);
                cleanCache();
                return t(locTxt, { lang });
            })
            .then((translation) => {
                expect(translation).to.be.equal(locTxt);
                return testDbLocale(locTxt, 'server', lang);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('Insert string in default language (en)', (done) => {
        const waitForMissing = [];
        const locTxt = 'String in default language';
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
        t(locTxt, { lang: DefaultLanguage })
            .then((translation) => {
                expect(translation).to.be.equal(locTxt);
                sinon.assert.calledOnce(missing);
                sinon.assert.calledWithExactly(missing, {
                    type: 'server',
                    text:
                    locTxt,
                    lang: DefaultLanguage,
                    extra: `Context.done (${resolve(__dirname)}/t.js:269:9)`,
                });
                sinon.assert.calledOnce(createLanguage);
                sinon.assert.calledWithExactly(createLanguage,
                    { lang: 'en' },
                    { lang: 'en', displayName: '' },
                    { new: true, upsert: true });
                missing.reset();
                // We must wait for missing to finish: it will insert the locale in db
                return Promise.all(waitForMissing);
            })
            .then(() => t(locTxt, { lang: DefaultLanguage }))
            .then((translation) => {
                expect(translation).to.be.equal(locTxt);
                cleanCache();
                return t(locTxt, { lang: DefaultLanguage });
            })
            .then((translation) => {
                expect(translation).to.be.equal(locTxt);
                return testDbLocale(locTxt, 'server', DefaultLanguage, false);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('Insert a handelbars templated string', (done) => {
        const waitForMissing = [];
        const locTxt = 'Templated {{data}}';
        const templateData = {
            data: 'Hi!',
        };
        const compiled = handlebars.compile(locTxt)(templateData);
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
        t(locTxt, { lang, templateData })
            .then((translation) => {
                expect(translation).to.be.equal(compiled);
                sinon.assert.calledOnce(missing);
                sinon.assert.calledWithExactly(missing, {
                    type: 'server',
                    text: locTxt,
                    lang,
                    extra: `Context.done (${resolve(__dirname)}/t.js:320:9)`,
                });
                sinon.assert.notCalled(createLanguage);
                missing.reset();
                // We must wait for missing to finish: it will insert the locale in db
                return Promise.all(waitForMissing);
            })
            .then(() => t(locTxt, { lang, templateData }))
            .then((translation) => {
                expect(translation).to.be.equal(compiled);
                cleanCache();
                return t(locTxt, { lang, templateData });
            })
            .then((translation) => {
                expect(translation).to.be.equal(compiled);
                return testDbLocale(locTxt, 'server', lang);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('Insert a handelbars templated string with error in template', (done) => {
        const waitForMissing = [];
        const locTxt = 'Templated {{data.something something}}';
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
        t(locTxt, { lang })
            .then(() => {
                sinon.assert.calledOnce(missing);
                sinon.assert.calledWithExactly(missing, {
                    type: 'server',
                    text: locTxt,
                    lang,
                    extra: `Context.done (${resolve(__dirname)}/t.js:362:9)`,
                });
                sinon.assert.notCalled(createLanguage);
                missing.reset();
                // We must wait for missing to finish: it will insert the locale in db
                return Promise.all(waitForMissing);
            })
            .then(() => {
                sinon.assert.calledOnce(logError);
                sinon.assert.calledWithExactly(logError, `Handlebars error (t function): ${locTxt}, ${lang}, ${new Error('Missing helper: "data.something"')}`);
                cleanCache();
                return t(locTxt, { lang });
            })
            .then((translation) => {
                expect(translation).to.be.equal(locTxt);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('Insert multiple locales in db and look for them', (done) => {
        const waitForMissing = [];
        const locArr = ['mlocale1', 'mlocale2'];
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
        // We cannot ensure the exact order in which stubbed functions will be called,
        // and we have already checked the arguments in previous test
        // so this is the reason why in this test we do not check arguments
        t(locArr, { lang, type })
            .then((translations) => {
                expect(translations).to.deep.equal(locArr);
                sinon.assert.calledTwice(missing);
                sinon.assert.notCalled(createLanguage);
                missing.reset();
                return Promise.all(waitForMissing);
            })
            .then(() => {
                sinon.assert.notCalled(logError);
                sinon.assert.calledTwice(logInfo);
                sinon.assert.calledTwice(sendMail);
                sendMail.reset();
                logError.reset();
                logInfo.reset();
                return t(locArr, { lang, type });
            })
            .then((translations) => {
                expect(translations).to.deep.equal(locArr);
                sinon.assert.notCalled(missing);
                cleanCache();
                return t(locArr, { lang, type });
            })
            .then(() => Promise.all(locArr.map(locTxt => testDbLocale(locTxt, type, lang))))
            .then(() => finish())
            .catch(finish);
    });

    it('Get all locales by type and language', (done) => {
        locales.findLocalesByType(type, lang)
            .then((localeDocs) => {
                expect(localeDocs).to.deep.equal({ mlocale2: '', mlocale1: '', 'New locale': '' });
            })
            .then(() => done())
            .catch(done);
    });

    it('Get all locales by type and language (-- language)', (done) => {
        locales.findLocalesByType(type, '--')
            .then((localeDocs) => {
                expect(localeDocs).to.deep.equal({ mlocale2: '', mlocale1: '', 'New locale': '' });
            })
            .then(() => done())
            .catch(done);
    });

    it('Get all locales by type and language (default language)', (done) => {
        locales.findLocalesByType(type, DefaultLanguage)
            .then((localeDocs) => {
                expect(localeDocs).to.deep.equal({ mlocale2: '', mlocale1: '', 'New locale': '' });
            })
            .then(() => done())
            .catch(done);
    });

    it('Get all locales by type and language (language is not existing)', (done) => {
        locales.findLocalesByType(type, 'fr')
            .then((localeDocs) => {
                expect(localeDocs).to.deep.equal({ mlocale2: '', mlocale1: '', 'New locale': '' });
            })
            .then(() => done())
            .catch(done);
    });

    it('Get all locales by type (without language)', (done) => {
        locales.findLocalesByType(type)
            .then((localeDocs) => {
                expect(localeDocs).to.deep.equal({ mlocale2: '', mlocale1: '', 'New locale': '' });
            })
            .then(() => done())
            .catch(done);
    });

    it('Get all locales by type and language (not existing type)', (done) => {
        locales.findLocalesByType('not-existing-type', lang)
            .then((localeDocs) => {
                expect(localeDocs).to.deep.equal({});
            })
            .then(() => done())
            .catch(done);
    });

    it('Update translation for existing locale, existing language', (done) => {
        setTranslation('mlocale2', 'translation', 'ca')
            .then((docs) => {
                expect(docs).to.be.an('array').lengthOf(1);
                const doc = docs[0];
                expect(doc.strings).to.be.an('array').lengthOf(2);
                expect(doc.strings.toObject()).to.deep.equal([
                    { text: 'mlocale2', lang: '--' },
                    { text: 'translation', lang: 'ca', extra: `Context.done (${resolve(__dirname)}/t.js:405:9)` },
                ]);
                sinon.assert.notCalled(logInfo);
                sinon.assert.notCalled(sendMail);
                sinon.assert.notCalled(createLanguage);
            })
            .then(() => done())
            .catch(done);
    });

    it('Get existing translation', (done) => {
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
        t('mlocale2', { lang: 'ca' })
            .then((translation) => {
                expect(translation).to.be.equal('translation');
                sinon.assert.notCalled(missing);
                sinon.assert.notCalled(logWarning);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('Update translation for existing locale, not existing language', (done) => {
        setTranslation('mlocale2', 'translation', 'fr')
            .then((docs) => {
                expect(docs).to.be.an('array').lengthOf(1);
                const doc = docs[0];
                expect(doc.strings).to.be.an('array').lengthOf(3);
                expect(doc.strings.toObject()).to.deep.equal([
                    { text: 'mlocale2', lang: '--' },
                    { text: 'translation', lang: 'ca', extra: `Context.done (${resolve(__dirname)}/t.js:405:9)` },
                    { text: 'translation', lang: 'fr', extra: `Context.done (${resolve(__dirname)}/t.js:528:9)` },
                ]);
                sinon.assert.notCalled(logInfo);
                sinon.assert.notCalled(sendMail);
                sinon.assert.calledOnce(createLanguage);
                sinon.assert.calledWithExactly(createLanguage,
                    { lang: 'fr' },
                    { lang: 'fr', displayName: '' },
                    { new: true, upsert: true });
            })
            .then(() => done())
            .catch(done);
    });

    it('Update translation for not existing locale, existing language', (done) => {
        setTranslation('mlocale3', 'translation', 'ca')
            .then((docs) => {
                expect(docs).to.be.an('array').lengthOf(1);
                const doc = docs[0];
                expect(doc.strings).to.be.an('array').lengthOf(2);
                expect(doc.strings.toObject()).to.deep.equal([
                    { text: 'mlocale3', lang: '--' },
                    { text: 'translation', lang: 'ca', extra: `Context.done (${resolve(__dirname)}/t.js:551:9)` },
                ]);
                sinon.assert.notCalled(logError);
                sinon.assert.calledOnce(logInfo);
                sinon.assert.calledWithExactly(logInfo, 'Inserted new translation for "mlocale3" - "ca"');
                sinon.assert.calledOnce(sendMail);
                sinon.assert.calledWithMatch(sendMail, {
                    from: 'me',
                    headers: { 'X-Laziness-level': 1000 },
                    // eslint-disable-next-line max-len
                    html: `Missing translation for <strong>mlocale3</strong><br>Type: server<br>At: <a href="Context.done (${resolve(__dirname)}/t.js:551:9)">Context.done (${resolve(__dirname)}/t.js:551:9)</a><br>Language: ca<br><br>Empty translation has been automatically added, please review them.`,
                    subject: 'Missing translation for "mlocale3"',
                    text: `Missing translation for "mlocale3"\nType: server\nAt: Context.done (${resolve(__dirname)}/t.js:551:9)\nLanguage: ca`,
                    to: 'me',
                });
                sinon.assert.notCalled(createLanguage);
            })
            .then(() => done())
            .catch(done);
    });

    it('Update translation for not existing locale, not existing language', (done) => {
        setTranslation('mlocale4', 'translation', 'ru')
            .then((docs) => {
                expect(docs).to.be.an('array').lengthOf(1);
                const doc = docs[0];
                expect(doc.strings).to.be.an('array').lengthOf(2);
                expect(doc.strings.toObject()).to.deep.equal([
                    { text: 'mlocale4', lang: '--' },
                    { text: 'translation', lang: 'ru', extra: `Context.done (${resolve(__dirname)}/t.js:580:9)` },
                ]);
                sinon.assert.notCalled(logError);
                sinon.assert.calledOnce(logInfo);
                sinon.assert.calledWithExactly(logInfo, 'Inserted new translation for "mlocale4" - "ru"');
                sinon.assert.calledOnce(sendMail);
                sinon.assert.calledWithMatch(sendMail, {
                    from: 'me',
                    headers: { 'X-Laziness-level': 1000 },
                    // eslint-disable-next-line max-len
                    html: `Missing translation for <strong>mlocale4</strong><br>Type: server<br>At: <a href="Context.done (${resolve(__dirname)}/t.js:580:9)">Context.done (${resolve(__dirname)}/t.js:580:9)</a><br>Language: ru<br><br>Empty translation has been automatically added, please review them.`,
                    subject: 'Missing translation for "mlocale4"',
                    text: `Missing translation for "mlocale4"\nType: server\nAt: Context.done (${resolve(__dirname)}/t.js:580:9)\nLanguage: ru`,
                    to: 'me',
                });
                sinon.assert.calledOnce(createLanguage);
                sinon.assert.calledWithExactly(createLanguage,
                    { lang: 'ru' },
                    { lang: 'ru', displayName: '' },
                    { new: true, upsert: true });
            })
            .then(() => done())
            .catch(done);
    });

    it('Update translation for not existing locale, not existing language, remove cached version', (done) => {
        t('mlocale3', { lang: 'hu' })
            .then((translation) => {
                expect(translation).equal('mlocale3');
                return setTranslation('mlocale3', 'translation', 'hu');
            })
            .then((docs) => {
                expect(docs).to.be.an('array').lengthOf(1);
                const doc = docs[0];
                expect(doc.strings).to.be.an('array').lengthOf(3);
                expect(doc.strings.toObject()).to.deep.equal([
                    { text: 'mlocale3', lang: '--' },
                    { text: 'translation', lang: 'ca', extra: `Context.done (${resolve(__dirname)}/t.js:551:9)` },
                    { text: 'translation', lang: 'hu', extra: `then.translation (${resolve(__dirname)}/t.js:616:24)` },
                ]);
                sinon.assert.notCalled(logError);
                sinon.assert.notCalled(logInfo);
                sinon.assert.notCalled(sendMail);
                sinon.assert.calledOnce(createLanguage);
                sinon.assert.calledWithExactly(createLanguage,
                    { lang: 'hu' },
                    { lang: 'hu', displayName: '' },
                    { new: true, upsert: true });
                return t('mlocale3', { lang: 'hu' });
            })
            .then((translation) => {
                expect(translation).equal('translation');
            })
            .then(() => done())
            .catch(done);
    });

    it('Update translation wrong parameters resolves promise', (done) => {
        setTranslation()
            .then((docs) => {
                expect(docs).to.be.an('array').lengthOf(0);
                sinon.assert.notCalled(logError);
                sinon.assert.notCalled(logInfo);
                sinon.assert.notCalled(sendMail);
                sinon.assert.notCalled(createLanguage);
            })
            .then(() => done())
            .catch(done);
    });

    it('Update translation wrong parameters resolves promise and does not insert language even if specified', (done) => {
        setTranslation('', 'some text', 'it')
            .then((docs) => {
                expect(docs).to.be.an('array').lengthOf(0);
                sinon.assert.notCalled(logError);
                sinon.assert.notCalled(logInfo);
                sinon.assert.notCalled(sendMail);
                sinon.assert.notCalled(createLanguage);
            })
            .then(() => done())
            .catch(done);
    });

    it('Remove locale type using default parameters', (done) => {
        // This will remove just one localeType (the first one matched)
        LocaleTypes.findAndModify(undefined, undefined, undefined, {
            remove: true,
        }, (err, typedocs) => {
            expect(err).to.be.null;
            expect(typedocs).to.be.an.object;
            expect(typedocs).to.have.all.keys(['_id', 'type']);
        })
            .then((typedocs) => {
                expect(typedocs).to.be.an.object;
                expect(typedocs).to.have.all.keys(['_id', 'type']);
                return LocaleTypes.find({ type: typedocs.type }).exec();
            })
            .then((typedocs) => {
                expect(typedocs).to.deep.equal([]);
            })
            .then(() => done())
            .catch(done);
    });
});
