import sinon from 'sinon';
import { expect } from 'chai';

import i18nMongo from '../src';
import { getAvailableLangs, initLanguages, Logger } from '../src/i18n-mongo';
import { languages } from './mongoMocks';
import { TEST_URI } from './mongodriver';

describe('Initializing i18n-mongo', () => {
    it('Init correctly and default logger works', () => {
        i18nMongo(TEST_URI);
        Logger.log('Hello!');
        Logger.error('Hello!');
        Logger.warning('Hello!');
        Logger.info('Hello!');
    });

    it('Logger should work', () => {
        const logger = {
            log: sinon.spy(),
        };
        i18nMongo(TEST_URI, {
            logger,
        });
        Logger.log('Hello!');
        sinon.assert.calledOnce(logger.log);
        sinon.assert.calledWith(logger.log, 'Hello!');
    });

    it('Init languages', (done) => {
        initLanguages()
            .then((langs) => {
                langs.forEach((lang, idx) => {
                    expect(lang).to.equal(languages[idx].lang);
                });
            })
            .then(() => done())
            .catch(done);
    });

    it('Get available languages should return languages', (done) => {
        getAvailableLangs()
            .then((langs) => {
                langs.forEach((lang, idx) => {
                    expect(lang.lang).to.equal(languages[idx].lang);
                    expect(lang.displayName).to.equal(languages[idx].displayName);
                });
            })
            .then(() => done())
            .catch(done);
    });

    it('Email initialization should work', () => {
        i18nMongo(TEST_URI, {
            email: {
                transport: {
                    sendMail: () => { },
                },
                from: '',
                to: '',
            },
        });
    });

    it('i18nMongo returns a middleware and works', () => {
        const mw = i18nMongo(TEST_URI);
        const nextSpy = sinon.spy();
        const cookie = sinon.spy();
        expect(mw).to.be.a('Function');
        expect(mw).to.have.lengthOf(3);

        mw({}, { cookie }, nextSpy);
        sinon.assert.calledOnce(nextSpy);
        sinon.assert.calledOnce(cookie);
        sinon.assert.calledWithExactly(cookie, 'lang', '--', { httpOnly: false, maxAge: 630720000000 });
    });
});
