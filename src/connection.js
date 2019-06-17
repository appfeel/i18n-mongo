import mongoose from 'mongoose';

mongoose.Promise = Promise;
let connection;

export { connection };

export function setConnection(con) {
    connection = con;
}

export default function connect(mongoUri, options = {}) {
    if (typeof mongoUri === 'string' && !connection.db) {
        return new Promise((resolve, reject) => {
            const opts = Object.assign({
                promiseLibrary: Promise,
                useNewUrlParser: true,
            }, options);
            connection = mongoose.connection;
            mongoose.connect(mongoUri, opts, e =>
                (e ? reject(e) : resolve(connection.db)));
        });
    } else if (typeof mongoUri !== 'string') {
        connection = mongoUri;
    }

    const { readyState } = connection;
    if (readyState === 1 && connection.db) {
        return Promise.resolve(connection.db);
    } else if (readyState === 2) {
        return new Promise(resolve => connection.on('connected', () => resolve(connection.db)));
    }

    return Promise.reject(new Error('Cannot connect to mongo'));
}

export function onceConnected() {
    return _onceConnected;
}
