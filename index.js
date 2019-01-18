"use strict";

const Bcrypt = require("bcrypt");
const Hapi = require("hapi");
const jwt = require("jsonwebtoken");
// const Joi = require("joi");
const cookie = require("cookie");

const jwtSecret = "secret";

const { User, Message } = require("./sequelizeInit");

const server = Hapi.server({
  port: 8080,
  host: "localhost"
});
const io = require("socket.io")(server.listener);

const genHash = async password => {
  return Bcrypt.hash(password, 8);
};

const checkPass = async (password, hash) => {
  return Bcrypt.compare(password, hash);
};

const authSuccess = async (h, user) => {
  const token = jwt.sign(
    {
      username: user.get("username")
    },
    jwtSecret,
    {
      expiresIn: "2h"
    }
  );

  h.state("data", { username: user.get("username"), token: token });
};

const getCurrentTime = async () => {
  var Data = new Date();
  var Hour = Data.getHours()
    .toString()
    .padStart(2, "0");
  var Minutes = Data.getMinutes();
  var Seconds = Data.getSeconds();
  var currentTime = `${Hour}:${Minutes}:${Seconds}`;
  return currentTime;
};

const verifyToken = async token => {
  var decoded = false;
  try {
    decoded = jwt.verify(token, jwtSecret);
  } catch (e) {
    decoded = false; // still false
  }
  return decoded;
};

// https://github.com/hapijs/nes

var onlineUsers = new Set();
io.on("connection", function(socket) {
  // check user for auth
  var cookies = cookie.parse(socket.handshake.headers.cookie);
  console.log(cookies);
  var token = cookies["token"];
  var username = cookies["username"];
  var verify = verifyToken(token);
  if (!verify) socket.disconnect(true);

  Message.findAll({ raw: true }).then(messages => {
    for (var i = 0; i < messages.length; i++) {
      var from_username = messages[i]["from_username"];
      var time = messages[i]["time"];
      var message = messages[i]["message"];
      socket.emit(
        "chat message",
        from_username + " (" + time + "): " + message
      );
    }
  });

  console.log(username + " connected");
  onlineUsers.add(username);
  io.emit("online", Array.from(onlineUsers));
  // console.log(onlineUsers);
  socket.on("disconnect", function() {
    console.log(username + " disconnected");
    onlineUsers.delete(username);
    io.emit("online", Array.from(onlineUsers));
    // console.log(onlineUsers);
  });

  socket.on("chat message", function(msg) {
    getCurrentTime().then(currentTime => {
      io.emit("chat message", username + " (" + currentTime + "): " + msg);

      // add message to DB
      Message.create({
        from_username: username,
        time: currentTime,
        message: msg
      });
    });
  });
});

const start = async () => {
  await server.register(require("inert"));

  server.state("data", {
    ttl: null,
    isSecure: false,
    isHttpOnly: true,
    encoding: "base64json",
    clearInvalid: false, // remove invalid cookies
    strictHeader: true // don't allow violations of RFC 6265
  });

  server.route({
    method: "GET",
    path: "/",
    handler(request, h) {
      let path = "auth.html";
      return h.file(path);
    }
  });

  server.route({
    method: "GET",
    path: "/chat",
    handler(request, h) {
      let path = "chat.html";
      if (
        typeof request.state.data != "undefined" &&
        typeof request.state.data.token != "undefined"
      ) {
        return verifyToken(request.state.data.token).then(verify => {
          return verify ? h.file(path) : h.redirect("/");
        });
      } else {
        return h.redirect("/");
      }
    }
  });

  server.route({
    method: "POST",
    path: "/auth",
    handler: function(request, h) {
      const username = request.payload.username;
      const password = request.payload.password;

      return (async function() {
        return User.findOne({
          where: {
            username: username
          }
        }).then(async user => {
          // check user exist
          if (user) {
            // check user password
            const passwordValid = await checkPass(
              password,
              user.get("password")
            );
            if (passwordValid) {
              return authSuccess(h, user).then(() => {
                return h.redirect("/chat");
              });
            } else {
              return h.redirect("/");
            }
          } else {
            // register user
            return User.create({
              username: request.payload.username,
              password: await genHash(request.payload.password)
            }).then(user => {
              // proceed user to chat
              authSuccess(h, user);
              return h.redirect("/chat");
            });
          }
        });
      })();
    }
  });

  server.ext("onPreResponse", (request, h) => {
    const response = request.response;
    if (response.isBoom && response.output.statusCode === 404) {
      return h.file("404.html").code(404);
    }

    return h.continue;
  });

  await server.start();

  console.log("server running at: " + server.info.uri);
};

start();
