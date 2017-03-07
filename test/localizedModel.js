/* eslint-disable no-unused-expressions */
import mongoose from 'mongoose';
import sinon from 'sinon';
import { expect } from 'chai';
import { Types } from 'mongoose';

import i18nMongo, { DefaultLanguage, Locale, Lang } from '../src';
import { Localizable } from './mongoMocks';
import { cleanCache } from '../src/strCache';


describe('Localizable model', () => {
    const lang = 'ca';
    const logInfo = sinon.spy();
    const logError = sinon.spy();
    const logWarning = sinon.spy();
    const sendMail = sinon.spy((message, cb) => cb(null, 'Ok'));
    const original = {
        localized: 'Localizable string 1',
        obj: { localized: 'Localizable string 2' },
        arr: [{ localized: 'Localizable string 3' }, { localized: 'Localizable string 4' }],
    };
    const translated = {
        localized: 'Text traduït 1',
        obj: { localized: 'Text traduït 2' },
        arr: [{ localized: 'Text traduït 3' }, { localized: 'Text traduït 4' }],
    };
    const translatedModified = {
        localized: 'Text traduït 1-Nou text',
        obj: { localized: 'Text traduït 2-Nou text' },
        arr: [{ localized: 'Text traduït 3-Nou text' }, { localized: 'Text traduït 4-Nou text' }],
    };
    let gDocId;
    const gDocsArr = [];


    before((done) => {
        i18nMongo(mongoose.connection, {
            logger: { info: logInfo, error: logError, warning: logWarning },
            email: {
                transport: {
                    sendMail,
                },
                from: 'me',
                to: 'me',
            },
        });
        Localizable.find({}).exec().then((docs) => {
            docs.forEach(doc => doc.remove());
            done();
        });
    });

    beforeEach(() => {
        cleanCache();
        logInfo.reset();
        logWarning.reset();
        logError.reset();
        sendMail.reset();
    });

    it('Create localized document simple text', (done) => {
        Localizable.saveLocalized(original, lang)
            .then((doc) => {
                // __v: 0,
                // localized: 58a4d53c919e4720d841131b,
                // _id: 58a4d53c919e4720d841131f,
                // arr:
                // [ { localized: 58a4d53c919e4720d841131d,
                //     _id: 58a4d53c919e4720d8411321 },
                //     { localized: 58a4d53c919e4720d841131e,
                //     _id: 58a4d53c919e4720d8411320 } ],
                // obj: { localized: 58a4d53c919e4720d841131c } }
                expect(doc).an('object');
                expect(doc).property('_id');
                expect(doc).property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc).property('arr');
                expect(doc).property('__v');
                expect(doc).property('obj')
                    .an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc.arr).an('array').lengthOf(2);
                expect(doc.arr[0]).an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc.arr[1]).an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);

                sinon.assert.callCount(logInfo, 4);
                sinon.assert.callCount(sendMail, 4);

                gDocId = doc._id; // To be used in later tests
            })
            .then(() => done())
            .catch(done);
    });

    it('Locales are correctly inserted and localized document is correctly refferenced', (done) => {
        let locIds;
        Localizable.find(gDocId).exec()
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);

                const doc = docs[0];
                locIds = [
                    doc.localized,
                    doc.obj.localized,
                    doc.arr[0].localized,
                    doc.arr[1].localized,
                ];

                return Promise.all(locIds.map(_id => Locale.find({ _id })));
            })
            .then(localeDocsArr => localeDocsArr.forEach((localeDocs, idx) => {
                // Verify that locales have been correctly inserted
                expect(localeDocs).an('array').lengthOf(1);
                expect(localeDocs[0]).property('_id');
                expect(localeDocs[0]).property('strings').an('array').lengthOf(2);
                expect(localeDocs[0]).property('refs').an('array').lengthOf(1);
                expect(localeDocs[0]._id.toString()).to.equal(locIds[idx].toString());
            }))
            .then(() => Localizable.findLocalized(gDocId, 'en'))
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
                const doc = docs[0];
                delete doc._id;
                delete doc.__v;
                expect(doc).to.deep.equal(original);
            })
            .then(() => done())
            .catch(done);
    });

    it('Get a localized document with find method, all localizable fields are ObjectId', (done) => {
        Localizable.find(gDocId).limit(1).lean().exec()
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
                const doc = docs[0];
                expect(doc).an('object');
                expect(doc).property('_id');
                expect(doc).property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc).property('arr');
                expect(doc).property('__v');
                expect(doc).property('obj')
                    .an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc.arr).an('array').lengthOf(2);
                expect(doc.arr[0]).an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc.arr[1]).an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);
            })
            .then(() => done())
            .catch(done);
    });

    it('Get a localized document simple text with corresponding strings (default language)', (done) => {
        Localizable.findLocalized(gDocId, DefaultLanguage)
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
                const doc = docs[0];
                delete doc._id;
                delete doc.__v;
                expect(doc).to.deep.equal(original);
            })
            .then(() => done())
            .catch(done);
    });

    it('Get a localized document in specified language', () => {
        Localizable.findLocalized(gDocId, lang)
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
                const doc = docs[0];
                delete doc._id;
                delete doc.__v;
                expect(doc).to.deep.equal(original);
            });
    });

    it('Get a localized document populated with locales (get with no language)', (done) => {
        Localizable.findLocalized(gDocId)
            .then((docs) => {
                const checkLocalized = (obj, value) => {
                    // each locale should look like this:
                    // { _id: 58a70832e145bb2fb5821002,
                    //     refs: [ 58a70832e145bb2fb5821006 ],
                    //     strings:
                    //     [ { lang: 'ca', text: 'Localizable string 1', extra: '' },
                    //         { lang: '--', text: 'Localizable string 1', extra: '' } ],
                    //     __v: 1 }
                    expect(obj).an('object').property('localized');
                    expect(obj.localized).an('object').all.keys(['_id', 'refs', 'strings', '__v']);
                    expect(obj.localized.strings).an('array').lengthOf(2);
                    expect(obj.localized.strings[0]).an('object').all.keys(['lang', 'text', 'extra']);
                    expect(obj.localized.strings[0].text).to.equal(value);
                    expect(obj.localized.strings[0].lang).oneOf([lang, '--']);
                    expect(obj.localized.strings[1]).an('object').all.keys(['lang', 'text', 'extra']);
                    expect(obj.localized.strings[1].text).to.equal(value);
                    expect(obj.localized.strings[1].lang).oneOf([lang, '--']);
                };

                expect(docs).an('array').lengthOf(1);
                checkLocalized(docs[0], original.localized);
                expect(docs[0]).property('obj')
                    .an('object');
                checkLocalized(docs[0].obj, original.obj.localized);
                expect(docs[0]).property('arr')
                    .an('array').lengthOf(original.arr.length);
                docs[0].arr.forEach((obj, idx) => {
                    checkLocalized(obj, original.arr[idx].localized);
                });
            })
            .then(() => done())
            .catch(done);
    });

    it('Modify language locales for existing document (plain text in localizable keys)', (done) => {
        const _translated = Object.assign({ _id: gDocId }, translated);
        const findOriginal = Localizable.find(gDocId).exec()
            .then(docs => docs[0]);
        const translateIt = Localizable.saveLocalized(_translated, lang);
        let locIds;

        Promise.all([findOriginal, translateIt])
            .then(([originalDoc, translatedDoc]) => {
                // They must have refference to same locales
                expect(originalDoc.toObject()).to.deep.equal(translatedDoc.toObject());
                // Now we look for the document with all locales
                return Localizable.findLocalized(translatedDoc._id);
            })
            .then((translatedDoc) => {
                const checkStrings = (string, defValue, traValue) => {
                    if (string.lang === '--') {
                        expect(string.text).equal(defValue);
                    } else {
                        expect(string.lang).equal(lang);
                        expect(string.text).equal(traValue);
                    }
                };
                expect(translatedDoc).an('array').lengthOf(1);
                const doc = translatedDoc[0];

                doc.localized.strings.forEach(string =>
                    checkStrings(string, original.localized, translated.localized));
                doc.obj.localized.strings.forEach(string =>
                    checkStrings(string, original.obj.localized, translated.obj.localized));
                doc.arr.forEach((arr, i) => arr.localized.strings.forEach(string =>
                    checkStrings(string, original.arr[i].localized, translated.arr[i].localized)));
                return Localizable.findLocalized(doc._id, lang);
            })
            .then((translatedDoc) => {
                expect(translatedDoc).an('array').lengthOf(1);
                const doc = translatedDoc[0];
                delete doc._id;
                delete doc.__v;
                expect(doc).to.deep.equal(translated);
            })
            .then(() => Localizable.find(gDocId))
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);

                // Check that locales are ok
                const doc = docs[0];
                locIds = [
                    doc.localized,
                    doc.obj.localized,
                    doc.arr[0].localized,
                    doc.arr[1].localized,
                ];

                return Promise.all(locIds.map(_id => Locale.find({ _id })));
            })
            .then(localeDocsArr => localeDocsArr.forEach((localeDocs, idx) => {
                // Verify that locales have been correctly inserted
                expect(localeDocs).an('array').lengthOf(1);
                expect(localeDocs[0]).property('_id');
                expect(localeDocs[0]).property('strings').an('array').lengthOf(2);
                expect(localeDocs[0]).property('refs').an('array').lengthOf(1);
                expect(localeDocs[0]._id.toString()).to.equal(locIds[idx].toString());
            }))
            .then(() => done())
            .catch(done);
    });

    it('Modify language locales for existing document (locales object in localizable keys)', (done) => {
        Localizable.findLocalized(gDocId)
            .then((docs) => {
                const changeLocale = (string) => {
                    if (string.lang === lang) {
                        // eslint-disable-next-line no-param-reassign
                        string.text = `${string.text}-Nou text`;
                        return false;
                    }
                    return true;
                };
                expect(docs).an('array').lengthOf(1);
                const doc = docs[0];
                doc.localized.strings.every(changeLocale);
                doc.obj.localized.strings.every(changeLocale);
                doc.arr.forEach(arr => arr.localized.strings.every(changeLocale));
                return Localizable.saveLocalized(doc);
            })
            .then(() => Localizable.findLocalized(gDocId))
            .then((translatedDoc) => {
                const checkStrings = (string, defValue, traValue) => {
                    if (string.lang === '--') {
                        expect(string.text).equal(defValue);
                    } else {
                        expect(string.lang).equal(lang);
                        expect(string.text).equal(`${traValue}-Nou text`);
                    }
                };
                expect(translatedDoc).an('array').lengthOf(1);
                const doc = translatedDoc[0];

                doc.localized.strings.forEach(string =>
                    checkStrings(string, original.localized, translated.localized));
                doc.obj.localized.strings.forEach(string =>
                    checkStrings(string, original.obj.localized, translated.obj.localized));
                doc.arr.forEach((arr, i) => arr.localized.strings.forEach(string =>
                    checkStrings(string, original.arr[i].localized, translated.arr[i].localized)));
                return Localizable.findLocalized(doc._id, lang);
            })
            .then((translatedDoc) => {
                expect(translatedDoc).an('array').lengthOf(1);
                const doc = translatedDoc[0];
                delete doc._id;
                delete doc.__v;
                expect(doc).to.deep.equal(translatedModified);
            })
            .then(() => done())
            .catch(done);
    });

    it('Get all locales for an existing localizable document', (done) => {
        const findLocales = Localizable.findLocales(gDocId);
        const findLocalized = Localizable.findLocalized(gDocId);

        Promise.all([findLocales, findLocalized])
            .then(([locales, docs]) => {
                expect(docs).an('array').lengthOf(1);
                expect(locales).an('object').all.keys([gDocId.toString()]);
                expect(locales[gDocId]).an('array').lengthOf(4);
                const doc = docs[0];
                const locIds = [
                    doc.localized,
                    doc.obj.localized,
                    doc.arr[0].localized,
                    doc.arr[1].localized,
                ];

                locales[gDocId].forEach((locale) => {
                    locIds.every((locId, i) => {
                        if (locId._id.toString() === locale._id.toString()) {
                            expect(locId).to.deep.equal(locale);
                            locIds.splice(i, 1);
                            return false;
                        }
                        return true;
                    });
                });
                expect(locIds).lengthOf(0);
            })
            .then(() => done())
            .catch(done);
    });

    it('Insert new locale translation through document with locales object in localizable object keys', (done) => {
        Localizable.findLocalized(gDocId)
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);

                const doc = docs[0];
                doc.localized.strings.push({ lang: 'fr', text: 'Texte traduit', extra: '' });
                Localizable.saveLocalized(doc);
            })
            .then(() => Localizable.findLocalized(gDocId))
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
                const doc = docs[0];
                expect(doc).an('object').property('localized');
                expect(doc.localized).an('object').all.keys(['_id', 'refs', 'strings', '__v']);
                expect(doc.localized.strings).an('array').lengthOf(3);
                doc.localized.strings.forEach((string) => {
                    expect(string).an('object').all.keys(['lang', 'text', 'extra']);
                    expect(string.lang).oneOf([lang, '--', 'fr']);
                    if (string.lang === 'fr') {
                        expect(string.text).to.equal('Texte traduit');
                    } else if (string.lang === '--') {
                        expect(string.text).to.equal(original.localized);
                    } else {
                        expect(string.text).to.equal(`${translated.localized}-Nou text`);
                    }
                });
            })
            .then(() => done())
            .catch(done);
    });

    it('Remove previously inserted document removes corresponding locales', (done) => {
        let locIds;
        Localizable.find(gDocId)
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
                const doc = docs[0];

                locIds = [
                    doc.localized,
                    doc.obj.localized,
                    doc.arr[0].localized,
                    doc.arr[1].localized,
                ];

                return doc.remove();
            })
            .then(() => Localizable.find(gDocId))
            .then((docs) => {
                expect(docs).an('array').lengthOf(0);
                return locIds.map(locId => Locale.find(locId));
            })
            .then(promises => Promise.all(promises))
            .then(results => results.forEach(docs => expect(docs).an('array').lengthOf(0)))
            .then(() => done())
            .catch(done);
    });

    it('Insert two documents localized which share locales (locales are not be duplicated)', (done) => {
        const insert1 = Localizable.saveLocalized(original, lang);
        const insert2 = insert1.then(() => Localizable.saveLocalized(original, lang));
        Promise.all([insert1, insert2])
            .then((results) => {
                sinon.assert.callCount(logInfo, 4);
                sinon.assert.callCount(sendMail, 4);
                return results;
            })
            .then(results => results.map((doc) => {
                expect(doc).an('object');
                expect(doc).property('_id');
                expect(doc).property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc).property('arr');
                expect(doc).property('__v');
                expect(doc).property('obj')
                    .an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc.arr).an('array').lengthOf(2);
                expect(doc.arr[0]).an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc.arr[1]).an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);

                gDocsArr.push(doc);
                return [
                    doc.localized,
                    doc.obj.localized,
                    doc.arr[0].localized,
                    doc.arr[1].localized,
                ];
            }))
            .then((locIdsArr) => {
                expect(locIdsArr[0]).to.deep.equal(locIdsArr[1]);
                expect(gDocsArr[0]._id.toString()).not.equal(gDocsArr[1]._id.toString());
                expect(gDocsArr[0].localized.toString())
                    .equal(gDocsArr[0].localized.toString());
                expect(gDocsArr[0].obj.localized.toString())
                    .equal(gDocsArr[0].obj.localized.toString());
                expect(gDocsArr[0].arr[0].localized.toString())
                    .equal(gDocsArr[0].arr[0].localized.toString());
                expect(gDocsArr[0].arr[1].localized.toString())
                    .equal(gDocsArr[0].arr[1].localized.toString());

                return locIdsArr;
            })
            .then(locIdsArr => locIdsArr.reduce((total, curr) => [...total, ...curr], []))
            .then(locIds => Promise.all(locIds.map(locId => Locale.find(locId))))
            .then(locales => locales.reduce((total, curr) => [...total, ...curr], []))
            .then((locales) => {
                const docIds = gDocsArr.map(doc => doc._id.toString());
                locales.forEach((local) => {
                    const refs = local.refs.map(ref => ref.toString());
                    expect(refs).deep.members(docIds);
                });
            })
            .then(() => done())
            .catch(done);
    });

    it('Remove previously inserted document does not remove locales if they are still needed', (done) => {
        let locIds;
        // Remove first document
        Localizable.find(gDocsArr[0])
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
                const doc = docs[0];

                locIds = [
                    doc.localized,
                    doc.obj.localized,
                    doc.arr[0].localized,
                    doc.arr[1].localized,
                ];

                return doc.remove();
            })
            .then(() => Localizable.find(gDocsArr[0]))
            .then((docs) => {
                expect(docs).an('array').lengthOf(0);
                return locIds.map(locId => Locale.find(locId));
            })
            .then(promises => Promise.all(promises))
            .then(results => results.forEach(docs => expect(docs).an('array').lengthOf(1)))
            // Remove second document
            .then(() => Localizable.find(gDocsArr[1]))
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
                const doc = docs[0];

                locIds = [
                    doc.localized,
                    doc.obj.localized,
                    doc.arr[0].localized,
                    doc.arr[1].localized,
                ];

                return doc.remove();
            })
            .then(() => Localizable.find(gDocsArr[0]))
            .then((docs) => {
                expect(docs).an('array').lengthOf(0);
                return locIds.map(locId => Locale.find(locId));
            })
            .then(promises => Promise.all(promises))
            .then(results => results.forEach(docs => expect(docs).an('array').lengthOf(0)))
            .then(() => done())
            .catch(done);
    });

    it('Insert document with emtpy text (default language)', (done) => {
        const empty = {
            localized: '',
            obj: { localized: '' },
            arr: [{ localized: '' }, { localized: '' }],
        };
        Localizable.saveLocalized(empty)
            .then((doc) => {
                // __v: 0,
                // localized: 58a4d53c919e4720d841131b,
                // _id: 58a4d53c919e4720d841131f,
                // arr:
                // [ { localized: 58a4d53c919e4720d841131d,
                //     _id: 58a4d53c919e4720d8411321 },
                //     { localized: 58a4d53c919e4720d841131e,
                //     _id: 58a4d53c919e4720d8411320 } ],
                // obj: { localized: 58a4d53c919e4720d841131c } }
                expect(doc).an('object');
                expect(doc).property('_id');
                expect(doc).property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc).property('arr');
                expect(doc).property('__v');
                expect(doc).property('obj')
                    .an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc.arr).an('array').lengthOf(2);
                expect(doc.arr[0]).an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc.arr[1]).an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);

                sinon.assert.calledOnce(logInfo);
                sinon.assert.calledOnce(sendMail);

                const locIds = [
                    doc.localized,
                    doc.obj.localized,
                    doc.arr[0].localized,
                    doc.arr[1].localized,
                ];

                // All locales should be the same ObjectId
                locIds.reduce((prev, curr) => {
                    expect(prev.toString()).equal(curr.toString());
                    return curr;
                });

                gDocId = doc._id; // To be used in later tests
                return Localizable.findLocalized(gDocId);
            })
            .then((docs) => {
                expect(docs[0].localized.refs).an('array').lengthOf(1);
                expect(docs[0].localized.refs[0].toString()).equal(gDocId.toString());
                expect(docs[0].localized.strings).deep.equal([{ extra: '', text: '', lang: '--' }]);
            })
            .then(() => done())
            .catch(done);
    });

    it('Insert document with emtpy text (new language)', (done) => {
        let lastDocId;
        const empty = {
            localized: '',
            obj: { localized: '' },
            arr: [{ localized: '' }, { localized: '' }],
        };
        Localizable.saveLocalized(empty, 'it')
            .then((doc) => {
                // __v: 0,
                // localized: 58a4d53c919e4720d841131b,
                // _id: 58a4d53c919e4720d841131f,
                // arr:
                // [ { localized: 58a4d53c919e4720d841131d,
                //     _id: 58a4d53c919e4720d8411321 },
                //     { localized: 58a4d53c919e4720d841131e,
                //     _id: 58a4d53c919e4720d8411320 } ],
                // obj: { localized: 58a4d53c919e4720d841131c } }
                expect(doc).an('object');
                expect(doc).property('_id');
                expect(doc).property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc).property('arr');
                expect(doc).property('__v');
                expect(doc).property('obj')
                    .an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc.arr).an('array').lengthOf(2);
                expect(doc.arr[0]).an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc.arr[1]).an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);

                // They have been inserted in previous tests
                sinon.assert.notCalled(logInfo);
                sinon.assert.notCalled(sendMail);

                const locIds = [
                    doc.localized,
                    doc.obj.localized,
                    doc.arr[0].localized,
                    doc.arr[1].localized,
                ];

                // All locales should be the same ObjectId
                locIds.reduce((prev, curr) => {
                    expect(prev.toString()).equal(curr.toString());
                    return curr;
                });

                lastDocId = gDocId;
                gDocId = doc._id; // To be used in later tests
                return Localizable.findLocalized(gDocId);
            })
            .then((docs) => {
                const refs = docs[0].localized.refs;
                expect(refs).an('array').lengthOf(2);
                const refIds = [refs[0].toString(), refs[1].toString()].sort();
                expect(refIds).deep.equal([gDocId.toString(), lastDocId.toString()].sort());
                expect(docs[0].localized.strings).deep.equal([
                    { extra: '', text: '', lang: '--' },
                    { extra: '', text: '', lang: 'it' },
                ]);
            })
            .then(() => done())
            .catch(done);
    });

    it('Insert document with repeated locales', (done) => {
        const repeated = {
            localized: 'Repeated text',
            obj: { localized: 'Repeated text' },
            arr: [{ localized: 'Repeated text' }, { localized: 'Repeated text' }],
        };
        Localizable.saveLocalized(repeated, lang)
            .then((doc) => {
                // __v: 0,
                // localized: 58a4d53c919e4720d841131b,
                // _id: 58a4d53c919e4720d841131f,
                // arr:
                // [ { localized: 58a4d53c919e4720d841131d,
                //     _id: 58a4d53c919e4720d8411321 },
                //     { localized: 58a4d53c919e4720d841131e,
                //     _id: 58a4d53c919e4720d8411320 } ],
                // obj: { localized: 58a4d53c919e4720d841131c } }
                expect(doc).an('object');
                expect(doc).property('_id');
                expect(doc).property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc).property('arr');
                expect(doc).property('__v');
                expect(doc).property('obj')
                    .an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc.arr).an('array').lengthOf(2);
                expect(doc.arr[0]).an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc.arr[1]).an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);

                sinon.assert.calledOnce(logInfo);
                sinon.assert.calledOnce(sendMail);

                const locIds = [
                    doc.localized,
                    doc.obj.localized,
                    doc.arr[0].localized,
                    doc.arr[1].localized,
                ];

                // All locales should be the same ObjectId
                locIds.reduce((prev, curr) => {
                    expect(prev.toString()).equal(curr.toString());
                    return curr;
                });

                gDocId = doc._id; // To be used in later tests
            })
            .then(() => done())
            .catch(done);
    });

    it('Insert document with locales object', (done) => {
        const createLanguage = sinon.spy(Lang, 'findOneAndUpdate');
        const mixed = {
            localized: {
                strings: [{ text: 'Language test', lang: DefaultLanguage }, { text: 'Text traduït al català', lang: 'ca' }],
            },
            obj: {
                localized: {
                    strings: [{ text: 'Repeated text', lang: '--' }, { text: 'Nou idioma', lang: 'de' }],
                },
            },
            arr: [{ localized: 'Plain text' }, { localized: 'Repeated text' }],
        };
        const finish = (err) => {
            createLanguage.restore();
            done(err);
        };

        Localizable.saveLocalized(mixed, lang)
            .then((doc) => {
                // __v: 0,
                // localized: 58a4d53c919e4720d841131b,
                // _id: 58a4d53c919e4720d841131f,
                // arr:
                // [ { localized: 58a4d53c919e4720d841131d,
                //     _id: 58a4d53c919e4720d8411321 },
                //     { localized: 58a4d53c919e4720d841131e,
                //     _id: 58a4d53c919e4720d8411320 } ],
                // obj: { localized: 58a4d53c919e4720d841131c } }
                expect(doc).an('object');
                expect(doc).property('_id');
                expect(doc).property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc).property('arr');
                expect(doc).property('__v');
                expect(doc).property('obj')
                    .an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc.arr).an('array').lengthOf(2);
                expect(doc.arr[0]).an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc.arr[1]).an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);

                sinon.assert.calledTwice(logInfo);
                sinon.assert.calledTwice(sendMail);
                sinon.assert.calledOnce(createLanguage);

                expect(doc.obj.localized.toString()).equal(doc.arr[1].localized.toString());

                gDocId = doc._id; // To be used in later tests
                return Localizable.findLocalized(gDocId);
            })
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
                const doc = docs[0];
                let localized = doc.localized.strings;
                expect(localized[0].text).equal(mixed.localized.strings[0].text);
                expect(localized[0].lang).equal(mixed.localized.strings[0].lang);
                expect(localized[1].text).equal(mixed.localized.strings[1].text);
                expect(localized[1].lang).equal(mixed.localized.strings[1].lang);

                localized = doc.obj.localized.strings;
                expect(localized).deep.equal(doc.arr[1].localized.strings);
                const isMissing = localized.every((string) => {
                    if (string.lang === 'de') {
                        expect(string.text).equal(mixed.obj.localized.strings[1].text);
                        return false;
                    }
                    return true;
                });
                expect(isMissing).false;
                localized = doc.arr[0].localized.strings;
                expect(localized[0].text).equal(mixed.arr[0].localized);
            })
            .then(() => finish())
            .catch(finish);
    });

    it('Insert document with missing locale', (done) => {
        const mixed = {
            localized: {
                strings: [{ text: 'Language test', lang: DefaultLanguage }, { text: 'Text traduït al català', lang: 'ca' }],
            },
            obj: {
                localized: {
                    strings: [{ text: 'Repeated text', lang: '--' }, { text: 'Nou idioma', lang: 'de' }],
                },
            },
        };

        Localizable.saveLocalized(mixed, lang)
            .then((doc) => {
                // __v: 0,
                // localized: 58a4d53c919e4720d841131b,
                // _id: 58a4d53c919e4720d841131f,
                // arr:
                // [ { localized: 58a4d53c919e4720d841131d,
                //     _id: 58a4d53c919e4720d8411321 },
                //     { localized: 58a4d53c919e4720d841131e,
                //     _id: 58a4d53c919e4720d8411320 } ],
                // obj: { localized: 58a4d53c919e4720d841131c } }

                expect(doc).an('object');
                expect(doc).property('_id');
                expect(doc).property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc).property('arr');
                expect(doc).property('__v');
                expect(doc).property('obj')
                    .an('object')
                    .property('localized')
                    .instanceOf(Types.ObjectId);
                expect(doc.arr).an('array').lengthOf(0);

                sinon.assert.notCalled(logInfo);
                sinon.assert.notCalled(sendMail);

                gDocId = doc._id; // To be used in later tests
                return Localizable.findLocalized(gDocId);
            })
            .then((docs) => {
                expect(docs).an('array').lengthOf(1);
                const doc = docs[0];
                let localized = doc.localized.strings;
                expect(localized[0].text).equal(mixed.localized.strings[0].text);
                expect(localized[0].lang).equal(mixed.localized.strings[0].lang);
                expect(localized[1].text).equal(mixed.localized.strings[1].text);
                expect(localized[1].lang).equal(mixed.localized.strings[1].lang);

                localized = doc.obj.localized.strings;
                const isMissing = localized.every((string) => {
                    if (string.lang === 'de') {
                        expect(string.text).equal(mixed.obj.localized.strings[1].text);
                        return false;
                    }
                    return true;
                });
                expect(isMissing).false;
            })
            .then(() => done())
            .catch(done);
    });
});
