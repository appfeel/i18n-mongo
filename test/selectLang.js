/* eslint-disable no-unused-expressions */
// import request from 'supertest';
import mongoose from 'mongoose';
import sinon from 'sinon';
import { expect } from 'chai';

import i18nMongo from '../src';
import { addNewLanguage, getAvailableLangs, Lang } from '../src/i18n-mongo';

const LANG_MAX_AGE = 100;

describe('Select language', () => {
    it('Select (library default: en) default language and set "lang" cookie, no "accept-language" header in request', (done) => {
        const cookie = sinon.spy();
        const req = { headers: {} };
        const res = { cookie };
        const middleWare = i18nMongo(mongoose.connection, {
            maxAge: LANG_MAX_AGE,
        }, (err) => {
            if (err) {
                done(err);
            } else {
                middleWare(req, res, (e) => {
                    if (e) {
                        done(e);
                    } else {
                        expect(req).to.have.property('lang').and.equal('en');
                        sinon.assert.calledOnce(cookie);
                        sinon.assert.calledWithExactly(cookie, 'lang', 'en', {
                            maxAge: LANG_MAX_AGE,
                            httpOnly: false,
                        });
                        cookie.reset();
                        done();
                    }
                });
            }
        });
    });

    it('Select (library default: en) default language and set "custom-name" cookie, no "accept-language" header in request', (done) => {
        const cookie = sinon.spy();
        const req = { headers: {} };
        const res = { cookie };
        const middleWare = i18nMongo(mongoose.connection, {
            maxAge: LANG_MAX_AGE,
            langCookieName: 'custom-name',
        }, (err) => {
            if (err) {
                done(err);
            } else {
                middleWare(req, res, (e) => {
                    if (e) {
                        done(e);
                    } else {
                        expect(req).to.have.property('lang').and.equal('en');
                        sinon.assert.calledOnce(cookie);
                        sinon.assert.calledWithExactly(cookie, 'custom-name', 'en', {
                            maxAge: LANG_MAX_AGE,
                            httpOnly: false,
                        });
                        cookie.reset();
                        done();
                    }
                });
            }
        });
    });

    it('Select (library default: en) default language and not set "lang" cookie, (ca) available, no "accept-language" header in request', (done) => {
        const cookie = sinon.spy();
        const req = { headers: {} };
        const res = { cookie };
        const middleWare = i18nMongo(mongoose.connection, {
            maxAge: LANG_MAX_AGE,
            isSetCookie: false,
        }, (err) => {
            if (err) {
                done(err);
            } else {
                middleWare(req, res, (e) => {
                    if (e) {
                        done(e);
                    } else {
                        expect(req).to.have.property('lang').and.equal('en');
                        sinon.assert.notCalled(cookie);
                        cookie.reset();
                        done();
                    }
                });
            }
        });
    });

    it('Select (ca) default language and set "lang" cookie, (ca) available, no "accept-language" header in request', (done) => {
        const cookie = sinon.spy();
        const req = { headers: {} };
        const res = { cookie };
        const middleWare = i18nMongo(mongoose.connection, {
            maxAge: LANG_MAX_AGE,
            defaultLanguage: 'ca',
        }, (err) => {
            if (err) {
                done(err);
            } else {
                middleWare(req, res, (e) => {
                    if (e) {
                        done(e);
                    } else {
                        expect(req).to.have.property('lang').and.equal('ca');
                        sinon.assert.calledOnce(cookie);
                        sinon.assert.calledWithExactly(cookie, 'lang', 'ca', {
                            maxAge: LANG_MAX_AGE,
                            httpOnly: false,
                        });
                        cookie.reset();
                        done();
                    }
                });
            }
        });
    });

    it('Select language using "accept-language" header, (ca) first option, available', (done) => {
        const cookie = sinon.spy();
        const req = {
            headers: {
                'accept-language': 'ca,en-UK;q=0.8,fr;q=0.6,es-ES;q=0.4,es;q=0.2',
            },
        };
        const res = { cookie };
        const middleWare = i18nMongo(mongoose.connection, {
            maxAge: LANG_MAX_AGE,
        }, (err) => {
            if (err) {
                done(err);
            } else {
                middleWare(req, res, (e) => {
                    if (e) {
                        done(e);
                    } else {
                        expect(req).to.have.property('lang').and.equal('ca');
                        sinon.assert.calledOnce(cookie);
                        sinon.assert.calledWithExactly(cookie, 'lang', 'ca', {
                            maxAge: LANG_MAX_AGE,
                            httpOnly: false,
                        });
                        cookie.reset();
                        done();
                    }
                });
            }
        });
    });

    it('Select language using "accept-language" header, (fr) first option not available, (ca) second option, available', (done) => {
        const cookie = sinon.spy();
        const req = {
            headers: {
                'accept-language': 'fr,ca;q=0.8,en-UK;q=0.8,es-ES;q=0.4,es;q=0.2',
            },
        };
        const res = { cookie };
        const middleWare = i18nMongo(mongoose.connection, {
            maxAge: LANG_MAX_AGE,
        }, (err) => {
            if (err) {
                done(err);
            } else {
                middleWare(req, res, (e) => {
                    if (e) {
                        done(e);
                    } else {
                        expect(req).to.have.property('lang').and.equal('ca');
                        sinon.assert.calledOnce(cookie);
                        sinon.assert.calledWithExactly(cookie, 'lang', 'ca', {
                            maxAge: LANG_MAX_AGE,
                            httpOnly: false,
                        });
                        cookie.reset();
                        done();
                    }
                });
            }
        });
    });

    it('Select language using "accept-language" header, (en-UK) first option not available, (ca) second option, available', (done) => {
        const cookie = sinon.spy();
        const req = {
            headers: {
                'accept-language': 'en-UK,ca;q=0.8,fr;q=0.6,es-ES;q=0.4',
            },
        };
        const res = { cookie };
        const middleWare = i18nMongo(mongoose.connection, {
            maxAge: LANG_MAX_AGE,
        }, (err) => {
            if (err) {
                done(err);
            } else {
                middleWare(req, res, (e) => {
                    if (e) {
                        done(e);
                    } else {
                        expect(req).to.have.property('lang').and.equal('ca');
                        sinon.assert.calledOnce(cookie);
                        sinon.assert.calledWithExactly(cookie, 'lang', 'ca', {
                            maxAge: LANG_MAX_AGE,
                            httpOnly: false,
                        });
                        cookie.reset();
                        done();
                    }
                });
            }
        });
    });

    it('Select language using "accept-language" header, (en-UK) first option not available, (en) generic available', (done) => {
        const cookie = sinon.spy();
        const req = {
            headers: {
                'accept-language': 'en-UK;q=0.8,fr;q=0.6,es-ES;q=0.4',
            },
        };
        const res = { cookie };
        const middleWare = i18nMongo(mongoose.connection, {
            maxAge: LANG_MAX_AGE,
        }, (err) => {
            if (err) {
                done(err);
            } else {
                middleWare(req, res, (e) => {
                    if (e) {
                        done(e);
                    } else {
                        expect(req).to.have.property('lang').and.equal('en');
                        sinon.assert.calledOnce(cookie);
                        sinon.assert.calledWithExactly(cookie, 'lang', 'en', {
                            maxAge: LANG_MAX_AGE,
                            httpOnly: false,
                        });
                        cookie.reset();
                        done();
                    }
                });
            }
        });
    });

    it('Select language (library default: en) using "accept-language" header, none of them available', (done) => {
        const cookie = sinon.spy();
        const req = {
            headers: {
                'accept-language': 'fr,ru',
            },
        };
        const res = { cookie };
        const middleWare = i18nMongo(mongoose.connection, {
            maxAge: LANG_MAX_AGE,
            defaultLanguage: 'en',
        }, (err) => {
            if (err) {
                done(err);
            } else {
                middleWare(req, res, (e) => {
                    if (e) {
                        done(e);
                    } else {
                        expect(req).to.have.property('lang').and.equal('en');
                        sinon.assert.calledOnce(cookie);
                        sinon.assert.calledWithExactly(cookie, 'lang', 'en', {
                            maxAge: LANG_MAX_AGE,
                            httpOnly: false,
                        });
                        cookie.reset();
                        done();
                    }
                });
            }
        });
    });

    it('Select (en) from cookie, don\'t call set cookie', (done) => {
        const cookie = sinon.spy();
        const req = {
            headers: {
                'accept-language': 'en-UK;q=0.8,fr;q=0.6,es-ES;q=0.4',
            },
            cookies: {
                lang: 'en',
            },
        };
        const res = { cookie };
        const middleWare = i18nMongo(mongoose.connection, {
            maxAge: LANG_MAX_AGE,
        }, (err) => {
            if (err) {
                done(err);
            } else {
                middleWare(req, res, (e) => {
                    if (e) {
                        done(e);
                    } else {
                        expect(req).to.have.property('lang').and.equal('en');
                        sinon.assert.notCalled(cookie);
                        cookie.reset();
                        done();
                    }
                });
            }
        });
    });
});

describe('Add new language', () => {
    it('Create a new language in database (fr)', (done) => {
        i18nMongo(mongoose.connection, {
            maxAge: LANG_MAX_AGE,
        }, (err) => {
            if (err) {
                done(err);
            } else {
                addNewLanguage('fr')
                    .then((lang) => {
                        expect(lang.lang).to.equal('fr');
                        expect(lang.displayName).to.equal('');
                        return getAvailableLangs({ lang: 'fr' });
                    })
                    .then((langs) => {
                        expect(langs.length).to.equal(1);
                        expect(langs[0].lang).to.equal('fr');
                        expect(langs[0].displayName).to.equal('');
                        done();
                    })
                    .catch(done);
            }
        });
    });

    it('Create a new language in database (fr) with displayName', (done) => {
        i18nMongo(mongoose.connection, {
            maxAge: LANG_MAX_AGE,
        }, (err) => {
            if (err) {
                done(err);
            } else {
                addNewLanguage('it', 'Italià')
                    .then((lang) => {
                        expect(lang.lang).to.equal('it');
                        expect(lang.displayName).to.equal('Italià');
                        return getAvailableLangs({ lang: 'it' });
                    })
                    .then((langs) => {
                        expect(langs.length).to.equal(1);
                        expect(langs[0].lang).to.equal('it');
                        expect(langs[0].displayName).to.equal('Italià');
                        done();
                    })
                    .catch(done);
            }
        });
    });

    it('Do not create existing language (ca)', (done) => {
        i18nMongo(mongoose.connection, {
            maxAge: LANG_MAX_AGE,
        }, (err) => {
            if (err) {
                done(err);
            } else {
                addNewLanguage('ca')
                    .then(r => expect(r).to.be.undefined)
                    .then(() => done())
                    .catch(done);
            }
        });
    });
});

describe('Database error', () => {
    it('Database error is catched and logged', (done) => {
        let stub;
        const finish = (err) => {
            if (stub) {
                stub.restore();
            }
            done(err);
        };
        const error = new Error('Simulated db error');
        const logger = {
            error: sinon.spy(),
        };
        i18nMongo(mongoose.connection); // We need to make a first call in order to be able to stub Lang.find
        const promise = new Promise((resolve) => {
            stub = sinon.stub(Lang, 'find', () => ({
                exec: () => {
                    setTimeout(resolve, 1);
                    return Promise.reject(error);
                },
            }));
            i18nMongo(mongoose.connection, { logger });
            sinon.assert.calledOnce(stub);
        });

        promise.then(() => {
            sinon.assert.calledOnce(logger.error);
            sinon.assert.calledWith(logger.error, `Error selecting language: ${error}`);
            finish();
        })
        .catch(finish);
    });
});
