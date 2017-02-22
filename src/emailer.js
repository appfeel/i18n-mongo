let mTransport;
let mFrom;
let mTo;

function sendEmail(message) {
    return new Promise((resolve, reject) => {
        /* eslint-disable no-param-reassign */
        message.headers = message.headers || {};
        message.headers['X-Laziness-level'] = message.headers['X-Laziness-level'] || 1000;
        /* eslint-enable no-param-reassign */
        mTransport.sendMail(message, (err, info) => {
            if (err) {
                reject(err);
            } else {
                resolve(info);
            }
        });
    });
}

export default function emailer({ transport, from, to }) {
    mTransport = transport;
    mFrom = from || '"Language translation\u200B" <no-reply@i18n-mongo>';
    mTo = to;
}

export function fromTemplate(type, messageOptions, data) {
    const message = messageOptions;
    message.from = mFrom;
    message.to = mTo;

    if (message.to) {
        switch (type) {
            case 'missingTranslation':
                message.subject = `Missing translation for "${data.text.substr(0, 10)}`;
                message.subject += `${data.text.length > 10 ? '...' : ''}"`;
                message.text = `Missing translation for "${data.text}"\nType: ${data.type}\n`;
                message.text += `At: ${data.extra}\nLanguage: ${data.lang}`;
                message.html = `Missing translation for <strong>${data.text}</strong><br>`;
                message.html += `Type: ${data.type}<br>At: <a href="${data.extra}">${data.extra}</a><br>`;
                message.html += `Language: ${data.lang}<br><br>`;
                message.html += 'Empty translation has been automatically added, please review them.';
                break;

            default:
                message.subject = 'i18n-mongo: Unexpected error';
                message.text = `Cannot find email template: ${type}.`;
        }
        return sendEmail(message);
    }
    return Promise.reject('Missing email "to"');
}
