/* eslint-disable no-unused-expressions */
import sinon from 'sinon';
import { expect } from 'chai';
import handlebars from 'handlebars';

import strCache, { cleanCache, getCachedTranslation, isCached, registerHelpers, setCachedTranslation, __testonly__ } from '../src/strCache';
import { hashCode } from '../src/util';

describe('strCache', () => {
    beforeEach(() => {
        cleanCache();
    });

    it('Default helpers loaded and work properly', () => {
        const date = new Date('2017-02-07 9:55');
        expect(handlebars.helpers).to.have.property('formatDate');
        expect(handlebars.helpers).to.have.property('formatDateTime');

        expect(handlebars.compile('{{formatDate date lang}}')({ date, lang: 'ca' })).to.equal('7 febrer 2017');
        expect(handlebars.compile('{{formatDateTime date lang}}')({ date, lang: 'ca' })).to.equal('dimarts 7 febrer 2017 9:55');
    });

    it('Register a custom helper and get\'s called correctly', () => {
        const customHelper = sinon.spy(data => `Test: ${data}`);
        registerHelpers({ customHelper });

        expect(handlebars.compile('{{customHelper data}}')({ data: 'my test string' })).to.equal('Test: my test string');
        sinon.assert.calledOnce(customHelper);
        sinon.assert.calledWith(customHelper, 'my test string');
        handlebars.unregisterHelper('customHelper');
    });

    it('Insert plain string into cache should be recoverable', () => {
        const lang = 'en';
        const text = 'Test string';
        const hash = hashCode(text);

        expect(isCached(hash, lang)).to.be.false;

        const compiled = setCachedTranslation(text, lang, hash);

        expect(isCached(hash, lang)).to.be.true;
        expect(compiled()).to.equal(text);

        const cached = getCachedTranslation(hash, lang);

        expect(cached).to.equal(text);
    });

    it('Insert templated string into cache should be recoverable', () => {
        const lang = 'en';
        const text = 'This is a templated string: {{ formatDate date lang }}';
        const templateData = { date: new Date('2017-02-07 9:55'), lang };
        const hash = hashCode(text);

        expect(isCached(hash, lang)).to.be.false;

        const compiled = setCachedTranslation(text, lang, hash);
        expect(isCached(hash, lang)).to.be.true;
        expect(compiled(templateData)).to.equal('This is a templated string: February 7, 2017');

        const cached = getCachedTranslation(hash, lang, templateData);

        expect(cached).to.equal('This is a templated string: February 7, 2017');
    });

    it('Insert plain string into cache should be recoverable (no hash provided)', () => {
        const lang = 'en';
        const text = 'Test string';
        const hash = hashCode(text);

        expect(isCached(hash, lang)).to.be.false;

        const compiled = setCachedTranslation(text, lang);

        expect(isCached(hash, lang)).to.be.true;
        expect(compiled()).to.equal(text);

        const cached = getCachedTranslation(hash, lang);

        expect(cached).to.equal(text);
    });

    it('Insert templated string into cache should be recoverable (no hash provided)', () => {
        const lang = 'en';
        const text = 'This is a templated string: {{ formatDate date lang }}';
        const templateData = { date: new Date('2017-02-07 9:55'), lang };
        const hash = hashCode(text);

        expect(isCached(hash, lang)).to.be.false;

        const compiled = setCachedTranslation(text, lang);
        expect(isCached(hash, lang)).to.be.true;
        expect(compiled(templateData)).to.equal('This is a templated string: February 7, 2017');

        const cached = getCachedTranslation(hash, lang, templateData);

        expect(cached).to.equal('This is a templated string: February 7, 2017');
    });

    it('Try to recover a string not cached', () => {
        const lang = 'en';
        const text = 'Test string';
        const hash = hashCode(text);

        expect(isCached(hash, lang)).to.be.false;
        const cached = getCachedTranslation(hash, lang);

        expect(cached).to.equal('');
    });

    it('Insert string already cached', () => {
        const lang = 'en';
        const text = 'Test string';
        const hash = hashCode(text);

        expect(isCached(hash, lang)).to.be.false;

        const compiled1 = setCachedTranslation(text, lang, hash);
        const compiled2 = setCachedTranslation(text, lang, hash);

        expect(isCached(hash, lang)).to.be.true;
        expect(compiled1()).to.equal(text);
        expect(compiled2()).to.equal(text);

        const cached = getCachedTranslation(hash, lang);

        expect(cached).to.equal(text);
    });

    it('Clean cache', () => {
        const lang = 'ca';
        for (let i = 0; i < 100; i += 1) {
            setCachedTranslation(`Text ${i}`, lang);
        }

        cleanCache();
        for (let i = 0; i < 100; i += 1) {
            expect(isCached(hashCode(`Text ${i}`), lang)).to.be.false;
        }
    });

    it('Setup cacheExpire and use it to delete expired keys (one language)', (done) => {
        const lang = 'ca';
        const originalPurge = __testonly__.purgeCache;
        const purgeCache = sinon.stub(__testonly__, 'purgeCache', () => {
            purgeCache.restore();
            originalPurge();
            for (let i = 0; i < 100; i += 1) {
                expect(isCached(hashCode(`Text ${i}`), lang)).to.be.false;
            }
            done();
        });

        strCache(10, 0); // Every key will be expired

        // We must insert more keys than max keys in order to trigger purge cache
        for (let i = 0; i < 100; i += 1) {
            setCachedTranslation(`Text ${i}`, lang);
        }
        sinon.assert.notCalled(purgeCache); // It is inside a setTimeout
    });

    it('Setup cacheMaxKeys and use it to delete exceeding keys (one language)', (done) => {
        const lang = 'ca';
        const originalPurge = __testonly__.purgeCache;
        const purgeCache = sinon.stub(__testonly__, 'purgeCache', () => {
            purgeCache.restore();
            originalPurge();
            for (let i = 0; i < 90; i += 1) {
                expect(isCached(hashCode(`Text ${i}`), lang)).to.be.false;
            }
            for (let i = 90; i < 100; i += 1) {
                expect(isCached(hashCode(`Text ${i}`), lang)).to.be.true;
            }
            done();
        });

        strCache(10, 60 * 3600 * 1000);

        // We must insert more keys than max keys in order to trigger purge cache
        for (let i = 0; i < 100; i += 1) {
            setCachedTranslation(`Text ${i}`, lang);
        }
        sinon.assert.notCalled(purgeCache); // It is inside a setTimeout
    });

    it('Setup cacheMaxKeys and use it to delete exceeding keys (one language), rotate one key', (done) => {
        const lang = 'ca';
        const originalPurge = __testonly__.purgeCache;
        const purgeCache = sinon.stub(__testonly__, 'purgeCache', () => {
            purgeCache.restore();
            originalPurge();
            expect(isCached(hashCode('Text 0'), lang)).to.be.false;
            for (let i = 2; i < 11; i += 1) {
                expect(isCached(hashCode(`Text ${i}`), lang)).to.be.false;
            }
            for (let i = 11; i < 20; i += 1) {
                expect(isCached(hashCode(`Text ${i}`), lang)).to.be.true;
            }
            expect(isCached(hashCode('Text 1'), lang)).to.be.true;
            done();
        });

        strCache(10, 60 * 3600 * 1000);

        // We must insert more keys than max keys in order to trigger purge cache
        for (let i = 0; i < 20; i += 1) {
            setCachedTranslation(`Text ${i}`, lang);
        }
        setCachedTranslation('Text 1', lang);
        sinon.assert.notCalled(purgeCache); // It is inside a setTimeout
    });

    it('Setup cacheExpire and use it to delete expired keys (two languages)', (done) => {
        const lang1 = 'ca';
        const lang2 = 'en';
        const originalPurge = __testonly__.purgeCache;
        const purgeCache = sinon.stub(__testonly__, 'purgeCache', () => {
            purgeCache.restore();
            originalPurge();
            for (let i = 0; i < 100; i += 1) {
                const hash = hashCode(`Text ${i}`);
                expect(isCached(hash, lang1)).to.be.false;
                expect(isCached(hash, lang2)).to.be.false;
            }
            done();
        });

        strCache(10, 0); // Every key will be expired

        // We must insert more keys than max keys in order to trigger purge cache
        for (let i = 0; i < 100; i += 1) {
            const hash = hashCode(`Text ${i}`);
            setCachedTranslation(`Text ${i}`, lang1, hash);
            setCachedTranslation(`Text ${i}`, lang2, hash);
        }
        sinon.assert.notCalled(purgeCache); // It is inside a setTimeout
    });

    it('Setup cacheMaxKeys and use it to delete exceeding keys (two languages)', (done) => {
        const lang1 = 'ca';
        const lang2 = 'en';
        const originalPurge = __testonly__.purgeCache;
        const purgeCache = sinon.stub(__testonly__, 'purgeCache', () => {
            purgeCache.restore();
            originalPurge();
            for (let i = 0; i < 95; i += 1) {
                const hash = hashCode(`Text ${i}`);
                expect(isCached(hash, lang1)).to.be.false;
                expect(isCached(hash, lang2)).to.be.false;
            }
            for (let i = 95; i < 100; i += 1) {
                const hash = hashCode(`Text ${i}`);
                expect(isCached(hash, lang1)).to.be.true;
                expect(isCached(hash, lang2)).to.be.true;
            }
            done();
        });

        strCache(10, 60 * 3600 * 1000);

        // We must insert more keys than max keys in order to trigger purge cache
        for (let i = 0; i < 100; i += 1) {
            const hash = hashCode(`Text ${i}`);
            setCachedTranslation(`Text ${i}`, lang1, hash);
            setCachedTranslation(`Text ${i}`, lang2, hash);
        }
        sinon.assert.notCalled(purgeCache); // It is inside a setTimeout
    });
});
