const Hapi = require('hapi');

// const app = require('express')();
const http = require('http').Server(app);
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const io = require('socket.io')(http);
const cookie = require('cookie');

const jwtSecret = 'secret';

// connection uri
const host = process.env.DATABASE_HOST;
const sequelize = new Sequelize(`mysql://admin:pass@${host}/brave_chat`);

// test db connection
sequelize
    .authenticate()
    .then(() => {
        console.log('Connection has been established successfully.');
    })
    .catch(err => {
        console.error('Unable to connect to the database:', err);
    });

// Models
const User = sequelize.define('user', {
    username: {
        type: Sequelize.STRING
    },
    password: {
        type: Sequelize.STRING
    }
}, {
    // disable the modification of table names; By default, sequelize will automatically
    // transform all passed model names (first parameter of define) into plural.
    // if you don't want that, set the following
    freezeTableName: true,
    timestamps: false
});

const Message = sequelize.define('message', {
    from_username: {
        type: Sequelize.STRING
    },
    time: {
        type: Sequelize.TIME
    },
    message: {
        type: Sequelize.TEXT
    }
}, {
    // disable the modification of table names; By default, sequelize will automatically
    // transform all passed model names (first parameter of define) into plural.
    // if you don't want that, set the following
    freezeTableName: true,
    timestamps: false
});

// app.use(bodyParser.urlencoded({
//     extended: false
// }));
// app.use(bodyParser.json());
// app.use(cookieParser());

const server = Hapi.server({
    port: 8080,
    host: 'localhost'
});

// routes
server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => {

        return 'Hello, world!';
    }
});

// app.get('/', function (req, res) {
//     res.sendFile(__dirname + '/auth.html');
// });



app.post('/auth', function (req, res, next) {
    // if (req.body.username && req.body.username === 'user' && req.body.password && req.body.password === 'pass') {
    if (req.body.username && req.body.username !== '' && req.body.password && req.body.password !== '') {
        User.findOne({
            where: {
                username: req.body.username
            }
        }).then(user => {
            // check user exist
            if (user) {
                // check user password
                if (checkPass(req.body.password, user.get('password'))) {
                    // proceed user to chat
                    authSuccess(res, user);
                    res.redirect('/chat');
                } else {
                    // invalid password, go to login page
                    res.redirect('/');
                }
            } else {
                // register user
                User.create({
                    username: req.body.username,
                    password: genHash(req.body.password)
                }).then(user => {
                    // proceed user to chat
                    authSuccess(res, user);
                    res.redirect('/chat');
                })
            }
        })

    }

});

app.get('/chat', function (req, res) {
    var token = req.cookies['token'];
    var verify = verifyToken(token);
    if (!verify) {
        res.clearCookie('token');
        res.redirect('/');
    } else {
        // auth success, load chat
        res.sendFile(__dirname + '/chat.html');
    }
});

var onlineUsers = new Set();

io.on('connection', function (socket) {
    // check user for auth
    var cookies = cookie.parse(socket.handshake.headers.cookie);
    var token = cookies['token'];
    var username = cookies['username'];
    var verify = verifyToken(token);
    if (!verify) socket.disconnect(true);

    Message.findAll({raw: true}).then(messages => {
        for (i=0; i< messages.length; i++){
            var from_username = messages[i]['from_username'];
            var time = messages[i]['time'];
            var message = messages[i]['message'];
            socket.emit('chat message', from_username + ' (' + time + '): ' + message);
        }
    });

    console.log(username + ' connected');
    onlineUsers.add(username);
    io.emit('online', Array.from(onlineUsers))
    // console.log(onlineUsers);
    socket.on('disconnect', function () {
        console.log(username + ' disconnected');
        onlineUsers.delete(username);
        io.emit('online', Array.from(onlineUsers))
        // console.log(onlineUsers);
    });

    socket.on('chat message', function (msg) {
        var currentTime = getCurrentTime();
        io.emit('chat message', username + ' (' + currentTime + '): ' + msg);

        // add message to DB
        Message.create({
            from_username: username,
            time: currentTime,
            message: msg
        });
    });
});

http.listen(8080, function () {
    console.log('listening on *:8080');
});


//TODO: don't use sync, use async
function genHash(password) {
    return bcrypt.hashSync(password, 8);
}

function checkPass(password, hash) {
    return bcrypt.compareSync(password, hash); // true
}

function authSuccess(res, user) {
    const token = jwt.sign({
        username: user.get('username')
    }, jwtSecret, {
        expiresIn: '2h'
    });
    // res.send(token);
    // res.writeHead(200, {
    //     user: user.get('username'),
    //     token: token
    // });
    // res.setHeader('Set-Cookie', ['user='+ user.get('username'), 'token='+ token]);
    res.cookie('username', user.get('username'), {
        maxAge: 7200000,
        httpOnly: true
    });
    res.cookie('token', token, {
        maxAge: 7200000,
        httpOnly: true
    });
}

function verifyToken(token) {
    var decoded = false;
    try {
        decoded = jwt.verify(token, jwtSecret);
    } catch (e) {
        decoded = false; // still false
    }
    return decoded;
}

function getCurrentTime() {
    var Data = new Date();
    var Hour = Data.getHours().toString().padStart(2, '0');
    var Minutes = Data.getMinutes();
    var Seconds = Data.getSeconds();
    var currentTime = `${Hour}:${Minutes}:${Seconds}`;
    return currentTime;
}