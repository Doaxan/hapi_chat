'use strict';

const Bcrypt = require('bcrypt');
const Hapi = require('hapi');

async function checkPass(password, hash) {
    return await Bcrypt.compare(password, hash);
}

const start = async () => {

    const server = Hapi.server({
        port: 4000,
        host: 'localhost'
    });

    const passCheck = await checkPass('123', 'hash');
    if (!passCheck) {
        console.log(passCheck);
    }

    server.route({
        method: 'GET',
        path: '/',
        handler: function (request, h) {
            return 'welcome';
        }
    });

    await server.start();

    console.log('server running at: ' + server.info.uri);
};

start();