import mongoose from 'mongoose';

mongoose.Promise = Promise;
let connection;

export { connection };

export function setConnection(con) {
    connection = con;
}

export default function connect(mongoUri, options = {}) {
    return new Promise((resolve, reject) => {
        if (typeof mongoUri === 'string' && !connection.db) {
            const opts = Object.assign({
                promiseLibrary: Promise,
                useNewUrlParser: true,
                // useMongoClient: true, // Unneeded as of mongoose 5.x
            }, options);
            connection = mongoose.connection;
            mongoose.connect(mongoUri, opts, e =>
                (e ? reject(e) : resolve(connection.db)));
        } else {
            const { readyState } = connection;
            if (readyState === 1 && connection.db) {
                resolve(connection.db);
            } else if (readyState === 2) {
                connection.on('connected', () => resolve(connection.db));
            } else {
                reject('Cannot connect to mongo');
            }
        }
    }).then();
}

export function onceConnected() {
    return _onceConnected;
}
