import { Schema } from 'mongoose';
import { Localized } from '../src/i18n-mongo';

import { localizableModel } from '../src/locales';

const jsonLanguages = require('./dbmocks/languages');

export const localizableSchema = new Schema({
    localized: Localized,
    obj: {
        localized: Localized,
    },
    arr: [
        {
            _id: false,
            localized: Localized,
        },
    ],
});
export const Localizable = localizableModel('localizable', localizableSchema);

export const languages = jsonLanguages;

