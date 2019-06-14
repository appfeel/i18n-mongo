/* eslint-disable global-require */
import mongoose from 'mongoose';
import wtfnode from 'wtfnode';

import { connect, drop, fixtures, MODE_TEST } from './mongodriver';

const collections = {
    i18nmongolangs: require('./dbmocks/languages'),
};

mongoose.models = {};
mongoose.modelSchemas = {};
mongoose.Promise = global.Promise;

// process.on('unhandledRejection', (reason, promise) => {
//     console.log('Unhadled promise!', reason);
// });

describe('i18n-mongo', () => {
    before((done) => {
        connect(MODE_TEST)
            .then(() => drop())
            .then(() => fixtures(collections))
            .then(() => done())
            .catch(done);
    });

    // after((done) => {
    //     drop().then(done).catch(done);
    // });

    require('./util'); // Done
    require('./init'); // Done
    require('./selectLang'); // Done
    require('./models'); // Done
    require('./strCache'); // Done
    require('./emailer'); // Done
    require('./t'); // Done
    require('./localizedModel'); // Done
    require('./router'); // Done

    after(() => {
        mongoose.connection.close();
        setTimeout(() => {
            wtfnode.dump();
            process.exit();
        }, 1000);
    });
});
