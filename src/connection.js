import mongoose from 'mongoose';

mongoose.Promise = Promise;

export default function connect(mongoUri, options = {}) {
    const opts = Object.assign({
        promiseLibrary: Promise,
        // useMongoClient: true, // Unneeded as of mongoose 5.x
    }, options);
    return new Promise((resolve, reject) => {
        const { readyState } = mongoose.connection;
        if (readyState === 1 && mongoose.connection.db) {
            resolve(mongoose.connection.db);
        } else if (readyState === 2) {
            mongoose.connection.on('connected', () => resolve(mongoose.connection.db));
        } else {
            mongoose.connect(mongoUri, opts, e =>
                (e ? reject(e) : resolve(mongoose.connection.db)));
        }
    });
}
