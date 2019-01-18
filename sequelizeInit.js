const Sequelize = require('sequelize');

// connection uri
const host = process.env.DATABASE_HOST || 'localhost';
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

module.exports = {
    User,
    Message
}