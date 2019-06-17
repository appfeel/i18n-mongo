import mongoose, { Schema } from 'mongoose';
import { expect } from 'chai';

import { connection } from '../src/connection';
import i18nMongo, { LocalizedRefKey } from '../src';
import { Localizable } from './mongoMocks';
import { TEST_URI } from './mongodriver';


describe('Models', () => {
    before((done) => {
        i18nMongo(TEST_URI, null, done);
    });

    it('Create mongoose "i18nmongolang" model', () => {
        expect(connection.models).to.have.property('i18nmongolang');
        expect(connection.models.i18nmongolang.modelName).to.equal('i18nmongolang');
    });

    it('Create mongoose "i18nmongolang" schema', () => {
        expect(mongoose.modelSchemas).to.have.property('i18nmongolang');
        const paths = mongoose.modelSchemas.i18nmongolang.paths;
        expect(paths).to.have.all.keys(['_id', 'lang', 'displayName', '__v']);
        expect(paths.lang).to.be.instanceof(Schema.Types.String);
        expect(paths.displayName).to.be.instanceof(Schema.Types.String);
        expect(paths._id).to.be.instanceof(Schema.Types.ObjectId);
        expect(paths.__v).to.be.instanceof(Schema.Types.Number);
    });


    it('Create mongoose "i18nmongolocale" model', () => {
        expect(connection.models).to.have.property('i18nmongolocale');
        expect(connection.models.i18nmongolocale.modelName).to.equal('i18nmongolocale');
    });

    it('Create mongoose "i18nmongolocale" schema', () => {
        expect(mongoose.modelSchemas).to.have.property('i18nmongolocale');

        const paths = mongoose.modelSchemas.i18nmongolocale.paths;

        expect(paths).to.have.all.keys(['_id', 'strings', 'refs', '__v']);
        expect(paths.strings).to.be.instanceof(Schema.Types.DocumentArray);
        expect(paths.strings.schema.paths).to.have.all.keys(['lang', 'text', 'extra']);
        expect(paths.strings.schema.paths.lang).to.be.instanceof(Schema.Types.String);
        expect(paths.strings.schema.paths.text).to.be.instanceof(Schema.Types.String);
        expect(paths.strings.schema.paths.extra).to.be.instanceof(Schema.Types.String);

        expect(paths.refs).to.be.instanceof(Schema.Types.Array);
        expect(paths.refs.caster).to.be.instanceof(Schema.Types.ObjectId);

        expect(paths._id).to.be.instanceof(Schema.Types.ObjectId);
        expect(paths.__v).to.be.instanceof(Schema.Types.Number);
    });


    it('Create mongoose "i18nmongolocaletypes" model', () => {
        expect(connection.models).to.have.property('i18nmongolocaletypes');
        expect(connection.models.i18nmongolocaletypes.modelName).to.equal('i18nmongolocaletypes');
    });

    it('Create mongoose "i18nmongolocaletypes" schema', () => {
        expect(mongoose.modelSchemas).to.have.property('i18nmongolocaletypes');

        const localetypesSchema = mongoose.modelSchemas.i18nmongolocaletypes;

        expect(localetypesSchema.paths).to.have.all.keys(['_id', 'type', '__v']);
        expect(localetypesSchema.paths.type).to.be.instanceof(Schema.Types.String);
        expect(localetypesSchema.paths._id).to.be.instanceof(Schema.Types.ObjectId);
        expect(localetypesSchema.paths.__v).to.be.instanceof(Schema.Types.Number);

        expect(localetypesSchema.statics).itself.to.respondTo('findAndModify');
    });


    it('Create mongoose "i18nmongolocale" and "i18nmongolocaletypes" models with different name', () => {
        i18nMongo(TEST_URI, {
            langModelName: 'customLang',
            localeModelName: 'customLocale',
            localeTypesModelName: 'customLocaleTypes',
        }, () => {
            expect(connection.models).to.have.property('customLang');
            expect(connection.models.customLang.modelName).to.equal('customLang');
            expect(connection.models).to.have.property('customLocale');
            expect(connection.models.customLocale.modelName).to.equal('customLocale');
            expect(connection.models).to.have.property('customLocaleTypes');
            expect(connection.models.customLocaleTypes.modelName).to.equal('customLocaleTypes');
        });
    });

    it('Create mongoose "localizable" model', () => {
        // Created as we import Localizable from ./mongoMocks.js
        expect(Localizable).to.have.property('modelName');
        expect(Localizable.modelName).to.equal('localizable');
        expect(Localizable).to.have.property('localizedKeys');
        expect(Localizable.localizedKeys).to.deep.equal(['localized', 'obj.localized', 'arr.*.localized']);
        expect(Localizable).itself.to.respondTo('findLocales');
        expect(Localizable).itself.to.respondTo('findLocalized');
        expect(Localizable).itself.to.respondTo('saveLocalized');

        expect(connection.models).to.have.property('localizable');
        expect(connection.models.localizable.modelName).to.equal('localizable');
        expect(connection.models.localizable).to.have.property('localizedKeys');
        expect(connection.models.localizable.localizedKeys).to.deep.equal(['localized', 'obj.localized', 'arr.*.localized']);
        expect(connection.models.localizable).itself.to.respondTo('findLocales');
        expect(connection.models.localizable).itself.to.respondTo('findLocalized');
        expect(connection.models.localizable).itself.to.respondTo('saveLocalized');
    });

    it('Create mongoose "localizable" schema', () => {
        expect(mongoose.modelSchemas).to.have.property('localizable');

        const paths = mongoose.modelSchemas.localizable.paths;
        expect(paths).to.have.all.keys(['_id', 'localized', 'obj.localized', 'arr', '__v']);

        expect(paths.localized).to.be.instanceof(Schema.Types.ObjectId);
        expect(paths.localized.options).to.have.all.keys(['type', 'ref']);
        expect(paths.localized.options.type.schemaName).to.be.equal('ObjectId');
        expect(paths.localized.options.ref).to.equal(LocalizedRefKey);

        expect(paths['obj.localized']).to.be.instanceof(Schema.Types.ObjectId);
        expect(paths['obj.localized'].options).to.have.all.keys(['type', 'ref']);
        expect(paths['obj.localized'].options.type.schemaName).to.be.equal('ObjectId');
        expect(paths['obj.localized'].options.ref).to.equal(LocalizedRefKey);

        expect(paths.arr).to.be.instanceof(Schema.Types.DocumentArray);
        expect(paths.arr.schema.paths).to.have.all.keys(['localized']);
        expect(paths.arr.schema.paths.localized).to.be.instanceof(Schema.Types.ObjectId);


        expect(paths._id).to.be.instanceof(Schema.Types.ObjectId);
        expect(paths.__v).to.be.instanceof(Schema.Types.Number);
    });
});
