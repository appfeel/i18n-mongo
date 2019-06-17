import mongoose from 'mongoose';
import { connection, setConnection } from '../src/connection';

// In the real world it will be better if the production uri comes
// from an environment variable, instead of being hard coded.
export const PRODUCTION_URI = 'mongodb://127.0.0.1:27017/production';
export const TEST_URI = 'mongodb://127.0.0.1:27017/test-i18nmongo';

export const MODE_TEST = 'mode_test';
export const MODE_PRODUCTION = 'mode_production';

export function connect(mode) {
    return new Promise((res, rej) => {
        if (connection && connection.db) {
            res();
        } else {
            mongoose.connect(mode === MODE_TEST ? TEST_URI : PRODUCTION_URI, { useNewUrlParser: true, useFindAndModify: false }, (err) => {
                if (err) {
                    rej(err);
                } else {
                    setConnection(mongoose.connection);
                    res();
                }
            });
        }
    });
}

export function drop(collsToDelete = []) {
    if (!connection.db) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        // This is faster then dropping the database
        connection.db.collections((err, colls) => Promise.all(colls.map((coll) => {
            if (coll.collectionName.indexOf('system') === 0 || (collsToDelete.length && collsToDelete.indexOf(coll.collectionName) < 0)) {
                return Promise.resolve();
            }
            return new Promise((res, rej) => coll.drop(e => (e ? rej(e) : res())));
        })).then(() => resolve()).catch(reject));
    });
}

export function fixtures(collections) {
    if (!connection.db) {
        return Promise.reject(new Error('Missing database connection.'));
    }

    return Promise.all(Object.keys(collections).map(name => new Promise((res, rej) => {
        connection.db.createCollection(name, (err, collection) => {
            if (err) {
                rej(err);
            } else {
                collection.insertMany(collections[name], e => (e ? rej(e) : res()));
            }
        });
    })));
}
