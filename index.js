// Import the Express module
const express = require("express");

// const hb = require("express-handlebars");

// Create a new instance of Express
const app = express();

// Import the AllthatStuff game file.
const game = require("./game");

// connect MongoDB Atlas
// TODO: 
// const mongoose = require('mongoose');
// const gameModel = require('./models/games');

// let secrets;
// if (process.env.NODE_ENV == "production") {
//   secrets = process.env; // in prod the secrets are environment variables
// } else {
//   secrets = require("./secrets"); // in dev they are in secrets.json which is listed in .gitignore
// }

// TODO:
// mongoose.connect(secrets.MONGO_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// })
//   .then(() => {
//     console.log('MongoDB Connected...');
//   })
//   .catch(err => console.log(err));

// this configures express to use express-handlebars:
// app.engine("handlebars", hb());
// app.set("view engine", "handlebars");

// Serve static html, js, css, and image files from the 'public' directory:
app.use(express.static("./public"));

app.get("/", function(req, res) {
  res.sendFile(__dirname + "/public/index.html");
});

// app.get("/games", async (req, res) => {
//   // res.sendFile(__dirname + "/public/games.html");
//   // res.send('<h1>here you can see a list of all games played so far...</h1>');

//   // TODO: create and import gameModel file and create handlebars for /games route

//   const allGames = await gameModel.find({});

//   try {
//     console.log(allGames);
//     res.render("allgames", {
//       layout: "main",
//       allGames
//     });

//   } catch (err) {
//     console.log("err in allGames in /games: ", err);
//     res.status(500).send(err);
//   }

// });

// TODO: make this work:
// app.get('/games', function(req, res) {
  
//   gameModel.find({}, {}, function(err, results) {

//     if (err) {
//       console.log(err);
//       res.send([]);
//       return;
//     }

//     console.log(results);
//     res.send(results);
    
//     // res.render("allgames", {
//     //   layout: "main",
//     //   allGames: results
//     // });
//   });
// });

app.get("/preview", function(req, res) {
  res.sendFile(__dirname + "/public/preview/AllThatStuff_start-menu.png");
});

// TODO:
// const games = require("./controllers/controller.js");
// Create a new game entry
// app.post("/", games.create);

// ------------------------------------------
// // // Create a Node.js based http server on port 8080
// const server = require("http")
//   .createServer(app)
//   .listen(process.env.PORT || 8080, () =>
//     console.log("port 8080 listening! - AllThatStuff")
//   );
//
// // Create a Socket.IO server and attach it to the http server
// var io = require("socket.io").listen(server);
//
// // Listen for Socket.IO Connections. Once connected, start the game logic.
// io.sockets.on("connection", function(socket) {
//   //console.log('client connected');
//   game.initGame(io, socket);
// });

// ------------------------------------------
const server = require("http").Server(app);
const io = require("socket.io")(server, {
  origins:
    "localhost:8080 http://192.168.0.15:8080:* http://192.168.2.112:8080:* https://allthatstuff.herokuapp.com:* www.allthatstuff.fun:*"
});
server.listen(process.env.PORT || 8080, () =>
  console.log("port 8080 listening! - AllThatStuff")
);
// Listen for Socket.IO Connections. Once connected, start the game logic.
io.sockets.on("connection", function(socket) {
  //console.log('client connected');
  game.initGame(io, socket);
});
