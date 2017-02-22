/* eslint-disable no-unused-expressions */
import { expect } from 'chai';

import { hashCode, formatDate } from '../src/util';

describe('Util', () => {
    describe('hashCode', () => {
        it('Create a unique hash from string', () => {
            const hash = hashCode('String to create hash');
            expect(hash).to.be.equal(2136480604);
        });
        it('Create a unique hash from empty string', () => {
            const hash = hashCode('');
            expect(hash).to.be.equal(0);
        });
    });

    describe('formatDate', () => {
        it('Should format a date with given format and language', () => expect(formatDate(new Date('2017-02-07'), 'ca', 'LL')).to.equal('7 febrer 2017'));
        it('Should format a long date with given format and language', () => expect(formatDate(new Date('2017-02-07 9:55'), 'ca', 'LLLL')).to.equal('dimarts 7 febrer 2017 9:55'));
    });
});
