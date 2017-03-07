import mongoose, { Schema } from 'mongoose';
import { expect } from 'chai';

import { Localizable } from './mongoMocks';
import i18nMongo, { LocalizedRefKey } from '../src';


describe('Models', () => {
    i18nMongo(mongoose.connection);

    it('Create mongoose "lang" model', () => {
        expect(mongoose.models).to.have.property('i18nmongolang');
        expect(mongoose.models.i18nmongolang.modelName).to.equal('i18nmongolang');
    });

    it('Create mongoose "lang" schema', () => {
        expect(mongoose.modelSchemas).to.have.property('i18nmongolang');
        const paths = mongoose.modelSchemas.i18nmongolang.paths;
        expect(paths).to.have.all.keys(['_id', 'lang', 'displayName', '__v']);
        expect(paths.lang).to.be.instanceof(Schema.Types.String);
        expect(paths.displayName).to.be.instanceof(Schema.Types.String);
        expect(paths._id).to.be.instanceof(Schema.Types.ObjectId);
        expect(paths.__v).to.be.instanceof(Schema.Types.Number);
    });


    it('Create mongoose "locale" model', () => {
        expect(mongoose.models).to.have.property('i18nmongolocale');
        expect(mongoose.models.i18nmongolocale.modelName).to.equal('i18nmongolocale');
    });

    it('Create mongoose "locale" schema', () => {
        expect(mongoose.modelSchemas).to.have.property('i18nmongolocale');

        const paths = mongoose.modelSchemas.i18nmongolocale.paths;

        expect(paths).to.have.all.keys(['_id', 'strings', 'refs', '__v']);
        expect(paths.strings).to.be.instanceof(Schema.Types.DocumentArray);
        expect(paths.strings.schema.paths).to.have.all.keys(['_id', 'lang', 'text', 'extra']);
        expect(paths.strings.schema.paths._id).to.be.instanceof(Schema.Types.Mixed);
        expect(paths.strings.schema.paths._id.options.type).to.equal(false);
        expect(paths.strings.schema.paths.lang).to.be.instanceof(Schema.Types.String);
        expect(paths.strings.schema.paths.text).to.be.instanceof(Schema.Types.String);
        expect(paths.strings.schema.paths.extra).to.be.instanceof(Schema.Types.String);

        expect(paths.refs).to.be.instanceof(Schema.Types.Array);
        expect(paths.refs.caster).to.be.instanceof(Schema.Types.ObjectId);

        expect(paths._id).to.be.instanceof(Schema.Types.ObjectId);
        expect(paths.__v).to.be.instanceof(Schema.Types.Number);
    });


    it('Create mongoose "localetypes" model', () => {
        expect(mongoose.models).to.have.property('i18nmongolocaletypes');
        expect(mongoose.models.i18nmongolocaletypes.modelName).to.equal('i18nmongolocaletypes');
    });

    it('Create mongoose "localetypes" schema', () => {
        expect(mongoose.modelSchemas).to.have.property('i18nmongolocaletypes');

        const localetypesSchema = mongoose.modelSchemas.i18nmongolocaletypes;

        expect(localetypesSchema.paths).to.have.all.keys(['_id', 'type', '__v']);
        expect(localetypesSchema.paths.type).to.be.instanceof(Schema.Types.String);
        expect(localetypesSchema.paths._id).to.be.instanceof(Schema.Types.ObjectId);
        expect(localetypesSchema.paths.__v).to.be.instanceof(Schema.Types.Number);

        expect(localetypesSchema.statics).itself.to.respondTo('findAndModify');
    });


    it('Create mongoose "locale" and "localetypes" models with different name', () => {
        i18nMongo(mongoose.connection, {
            langModelName: 'customLang',
            localeModelName: 'customLocale',
            localeTypesModelName: 'customLocaleTypes',
        });
        expect(mongoose.models).to.have.property('customLang');
        expect(mongoose.models.customLang.modelName).to.equal('customLang');
        expect(mongoose.models).to.have.property('customLocale');
        expect(mongoose.models.customLocale.modelName).to.equal('customLocale');
        expect(mongoose.models).to.have.property('customLocaleTypes');
        expect(mongoose.models.customLocaleTypes.modelName).to.equal('customLocaleTypes');
    });

    it('Create mongoose "localizable" model', () => {
        expect(mongoose.models).to.have.property('localizable');
        expect(mongoose.models.localizable.modelName).to.equal('localizable');
        expect(mongoose.models.localizable).to.have.property('localizedKeys');
        expect(mongoose.models.localizable.localizedKeys).to.deep.equal(['localized', 'obj.localized', 'arr.*.localized']);
        expect(mongoose.models.localizable).itself.to.respondTo('findLocales');
        expect(mongoose.models.localizable).itself.to.respondTo('findLocalized');
        expect(mongoose.models.localizable).itself.to.respondTo('saveLocalized');

        expect(Localizable).to.have.property('modelName');
        expect(Localizable.modelName).to.equal('localizable');
        expect(Localizable).to.have.property('localizedKeys');
        expect(Localizable.localizedKeys).to.deep.equal(['localized', 'obj.localized', 'arr.*.localized']);
        expect(Localizable).itself.to.respondTo('findLocales');
        expect(Localizable).itself.to.respondTo('findLocalized');
        expect(Localizable).itself.to.respondTo('saveLocalized');
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
        expect(paths.arr.schema.paths).to.have.all.keys(['_id', 'localized']);
        expect(paths.arr.schema.paths.localized).to.be.instanceof(Schema.Types.ObjectId);


        expect(paths._id).to.be.instanceof(Schema.Types.ObjectId);
        expect(paths.__v).to.be.instanceof(Schema.Types.Number);
    });
});
