/* eslint-disable no-unused-expressions */
import mongoose from 'mongoose';
import sinon from 'sinon';
import { expect } from 'chai';

import i18nMongo from '../src';
import { fromTemplate } from '../src/emailer';

const type = 'client';
const text = 'Missing';
const lang = 'ca';
const extra = 'tests';

describe('Emailer', () => {
    it('Send an email when missingTranslation key invoked, reject when "to" is not specified', (done) => {
        const _sendMail = (message, callback) => callback(null, 'Ok');
        const sendMail = sinon.spy(_sendMail);
        i18nMongo(mongoose.connection, {
            email: {
                transport: {
                    sendMail,
                },
                from: '',
                to: '',
            },
        });

        fromTemplate('missingTranslation', {}, { type, text, lang, extra })
            .then(() => done('Should not be successful when "to" is missing'))
            .catch((err) => {
                expect(err).to.equal('Missing email "to"');
                done();
            });
    });

    it('Send an email when missingTranslation key invoked', (done) => {
        const _sendMail = (message, callback) => callback(null, 'Ok');
        const sendMail = sinon.spy(_sendMail);
        i18nMongo(mongoose.connection, {
            email: {
                transport: {
                    sendMail,
                },
                from: '',
                to: 'example@example.com',
            },
        });

        fromTemplate('missingTranslation', {}, { type, text, lang, extra })
            .then((info) => {
                expect(info).to.equal('Ok');
                sinon.assert.calledOnce(sendMail);
                sinon.assert.calledWith(sendMail, {
                    from: '"Language translation​" <no-reply@i18n-mongo>',
                    to: 'example@example.com',
                    subject: 'Missing translation for "Missing"',
                    text: 'Missing translation for "Missing"\nType: client\nAt: tests\nLanguage: ca',
                    html: 'Missing translation for <strong>Missing</strong><br>Type: client<br>At: <a href="tests">tests</a><br>Language: ca<br><br>Empty translation has been automatically added, please review them.',
                    headers: {
                        'X-Laziness-level': 1000,
                    },
                });
                done();
            })
            .catch(done);
    });

    it('Send an email when unknown key invoked', (done) => {
        const _sendMail = (message, callback) => callback(null, 'Ok');
        const sendMail = sinon.spy(_sendMail);
        i18nMongo(mongoose.connection, {
            email: {
                transport: {
                    sendMail,
                },
                from: '',
                to: 'example@example.com',
            },
        });

        fromTemplate('unknown', {}, { type, text, lang, extra })
            .then((info) => {
                expect(info).to.equal('Ok');
                sinon.assert.calledOnce(sendMail);
                sinon.assert.calledWith(sendMail, {
                    from: '"Language translation​" <no-reply@i18n-mongo>',
                    to: 'example@example.com',
                    subject: 'i18n-mongo: Unexpected error',
                    text: 'Cannot find email template: unknown.',
                    headers: {
                        'X-Laziness-level': 1000,
                    },
                });
                done();
            })
            .catch(done);
    });

    it('Send an email when missingTranslation key invoked (more than 10 chars string)', (done) => {
        const _sendMail = (message, callback) => callback(null, 'Ok');
        const sendMail = sinon.spy(_sendMail);
        i18nMongo(mongoose.connection, {
            email: {
                transport: {
                    sendMail,
                },
                from: '',
                to: 'example@example.com',
            },
        });

        fromTemplate('missingTranslation', {}, { type, text: 'Missing translation', lang, extra })
            .then((info) => {
                expect(info).to.equal('Ok');
                sinon.assert.calledOnce(sendMail);
                sinon.assert.calledWith(sendMail, {
                    from: '"Language translation​" <no-reply@i18n-mongo>',
                    to: 'example@example.com',
                    subject: 'Missing translation for "Missing tr..."',
                    text: 'Missing translation for "Missing translation"\nType: client\nAt: tests\nLanguage: ca',
                    html: 'Missing translation for <strong>Missing translation</strong><br>Type: client<br>At: <a href="tests">tests</a><br>Language: ca<br><br>Empty translation has been automatically added, please review them.',
                    headers: {
                        'X-Laziness-level': 1000,
                    },
                });
                done();
            })
            .catch(done);
    });

    it('"from" parameter is accepted', (done) => {
        const _sendMail = (message, callback) => callback(null, 'Ok');
        const sendMail = sinon.spy(_sendMail);
        i18nMongo(mongoose.connection, {
            email: {
                transport: {
                    sendMail,
                },
                from: 'example@example.com',
                to: 'example@example.com',
            },
        });

        fromTemplate('missingTranslation', {}, { type, text, lang, extra })
            .then((info) => {
                expect(info).to.equal('Ok');
                sinon.assert.calledOnce(sendMail);
                sinon.assert.calledWith(sendMail, {
                    from: 'example@example.com',
                    to: 'example@example.com',
                    subject: 'Missing translation for "Missing"',
                    text: 'Missing translation for "Missing"\nType: client\nAt: tests\nLanguage: ca',
                    html: 'Missing translation for <strong>Missing</strong><br>Type: client<br>At: <a href="tests">tests</a><br>Language: ca<br><br>Empty translation has been automatically added, please review them.',
                    headers: {
                        'X-Laziness-level': 1000,
                    },
                });
                done();
            })
            .catch(done);
    });

    it('"X-Laziness-level" parameter is accepted', (done) => {
        const _sendMail = (message, callback) => callback(null, 'Ok');
        const sendMail = sinon.spy(_sendMail);
        i18nMongo(mongoose.connection, {
            email: {
                transport: {
                    sendMail,
                },
                from: 'example@example.com',
                to: 'example@example.com',
            },
        });

        fromTemplate('missingTranslation', {
            headers: {
                'X-Laziness-level': 100,
            },
        }, { type, text, lang, extra })
            .then((info) => {
                expect(info).to.equal('Ok');
                sinon.assert.calledOnce(sendMail);
                sinon.assert.calledWith(sendMail, {
                    from: 'example@example.com',
                    to: 'example@example.com',
                    subject: 'Missing translation for "Missing"',
                    text: 'Missing translation for "Missing"\nType: client\nAt: tests\nLanguage: ca',
                    html: 'Missing translation for <strong>Missing</strong><br>Type: client<br>At: <a href="tests">tests</a><br>Language: ca<br><br>Empty translation has been automatically added, please review them.',
                    headers: {
                        'X-Laziness-level': 100,
                    },
                });
                done();
            })
            .catch(done);
    });

    it('sendMail failure rejects the promise', (done) => {
        const _sendMail = (message, callback) => callback('Error');
        const sendMail = sinon.spy(_sendMail);
        i18nMongo(mongoose.connection, {
            email: {
                transport: {
                    sendMail,
                },
                from: 'example@example.com',
                to: 'example@example.com',
            },
        });

        fromTemplate('missingTranslation', {}, { type, text, lang, extra })
            .then(() => done('Should not resolve the promise'))
            .catch(() => done());
    });
});
