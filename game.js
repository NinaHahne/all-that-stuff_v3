const cryptoRandomString = require("crypto-random-string");

const cardsEN = require("./cards_enUS.json");
const cardsDE = require("./cards_de.json");

var io;
var gameSocket;
const gameStates = {};
/**
 * This function is called by index.js to initialize a new game instance.
 *
 * @param sio The Socket.IO library
 * @param socket The socket object for the connected client.
 */
exports.initGame = function(sio, socket) {
  io = sio;
  gameSocket = socket;
  gameSocket.emit("connected", { message: "You are connected!" });

  // Host Events
  gameSocket.on("hostCreateNewGame", hostCreateNewGame);

  // Player Events
  gameSocket.on("playerJoinsRoom", playerJoinsRoom);
  gameSocket.on("welcome me", welcomePlayer);
  gameSocket.on("selected piece", selectedPiece);
  gameSocket.on("change language", changeLanguage);
  gameSocket.on("game started", gameStarted);

  gameSocket.on("disconnect", onDisconnect);

  // gameSocket.on("playerAnswer", playerAnswer);
  // gameSocket.on("playerRestart", playerRestart);
};

/* *******************************
 *                             *
 *       HOST FUNCTIONS        *
 *                             *
 ******************************* */

/**
 * The 'START' button was clicked and 'hostCreateNewGame' event occurred.
 */
function hostCreateNewGame() {
  // Create a unique Socket.IO Room
  // var thisGameId = (Math.random() * 100000) | 0;
  // const thisGameId = cryptoRandomString({length: 4, type: 'distinguishable'});
  // //=> 'CDE8'
  const thisGameId = cryptoRandomString({
    length: 4,
    characters: "ABCDEFGHJKLMNOPQRSTUVWXYZ"
  });
  //=> 'ABQR'

  // TODO: check if gameId is not already in use

  let socket = this;
  // initiate game state:
  initiateGameState(thisGameId, socket.id);

  // Return the Room ID (gameId) and the socket ID (mySocketId) to the browser client
  socket.emit("newGameCreated", { gameId: thisGameId, mySocketId: socket.id });

  // Join the Room and wait for the players
  socket.join(thisGameId.toString());
}

function initiateGameState(gameId, hostSocketId) {
  gameStates[gameId] = {
    gameStarted: false,
    gameHost: hostSocketId,
    gameMaster: "",
    joinedPlayers: {}, // { socketId: selectedPieceId, ... }
    selectedPieces: [], // [ pieceId, .... ]
    currentPlayer: "",
    // number of rounds, depending on number of players:
    numberOfTurnsForThisGame: 0,
    numberOfTurnsLeft: 0,

    // card deck: ----------------------
    cards: cardsEN,
    chosenLanguage: "english",

    stuffCards: [],
    discardPile: [],
    firstCard: "",
    newPile: false,

    // guessing & points: --------------
    correctAnswer: "",
    guessedAnswers: {}, // { pieceId: <guessed item number> }
    answeringOrder: [], // [ pieceId, ... ]
    playerPointsTotal: {}, // { pieceId: <points> }
    playerNames: {},
    doneBtnPressed: false,
    cardPointsHTML: "",
    guessingOrDiscussionTime: false,
    everyoneGuessed: false,

    // active and queued objects:
    activeObjects: "",
    queuedObjects: "",
    joinedPlayersHTML: "",
    buildersViewportWidth: "",
    dataForNextTurn: {}
  };
}

// /*
//  * at least 3 players have joined and the game master started the game.
//  * Alert the host!
//  * @param gameId The game ID / room ID
//  */
// function hostPrepareGame(gameId) {
//   var sock = this;
//   var data = {
//     mySocketId: sock.id,
//     gameId: gameId
//   };
//   // console.log("All Players Present. Preparing game...");
//   console.log('Game Master clicked "everybody\'s in / start game". Preparing game...');
//   io.sockets.in(data.gameId).emit("beginNewGame", data);
// }

// /*
//  * The Countdown has finished, and the game begins!
//  * @param gameId The game ID / room ID
//  */
// function hostStartGame(gameId) {
//   console.log("Game Started.");
//   sendWord(0, gameId);
// }

// /**
//  * A player answered correctly. Time for the next word.
//  * @param data Sent from the client. Contains the current round and gameId (room)
//  */
// function hostNextRound(data) {
//   if (data.round < wordPool.length) {
//     // Send a new set of words back to the host and players.
//     sendWord(data.round, data.gameId);
//   } else {
//     if (!data.done) {
//       data.done++;
//     }
//     // If the current round exceeds the number of words, send the 'gameOver' event.
//     io.sockets.in(data.gameId).emit("gameOver", data);
//   }
// }

/* *****************************
 *                           *
 *     PLAYER FUNCTIONS      *
 *                           *
 ***************************** */

/**
 * A player clicked the 'play' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */
function playerJoinsRoom(data) {
  // console.log('Player ' + data.playerName + ' attempting to join game room: ' + data.gameId );

  // A reference to the player's Socket.IO socket object
  let socket = this;

  // Look up the room ID in the Socket.IO adapter object.
  // console.log("data.gameId:", data.gameId);
  // var room = gameSocket.manager.rooms["/" + data.gameId];
  let room = gameSocket.adapter.rooms[data.gameId];

  // If the room exists...
  if (room) {
    // attach the socket id to the data object.
    data.mySocketId = socket.id;

    let gameId = data.gameId;

    // Join the room
    socket.join(gameId);
    console.log('Player ' + data.playerName + ' joining game room: ' + gameId );

    // Emit an event notifying the clients that the player has joined the room.
    io.sockets.in(gameId).emit("playerJoinedRoom", data);
  } else {
    // Otherwise, send an error message back to the player.
    socket.emit("errorMessage", { message: "This room does not exist." });
  }
}

function welcomePlayer(gameId) {
  // A reference to the player's Socket.IO socket object
  let socket = this;
  // welcome the player, giving them the list with players that joined
  // (and selected a piece) so far:
  socket.emit("welcome", {
    // userId: socket.userId,
    socketId: socket.id,
    selectedPieces: gameStates[gameId].selectedPieces,
    playerNames: gameStates[gameId].playerNames,
    chosenLanguage: gameStates[gameId].chosenLanguage,
    gameStarted: gameStates[gameId].gameStarted,
    gameMaster: gameStates[gameId].gameMaster
  });
}

function selectedPiece(data) {
  if (data.selectedPieceId) {
    console.log(
      `${data.playerName} joined the game with the color ${data.selectedPieceId}`
    );
    let game = gameStates[data.gameId];
    game.selectedPieces.push(data.selectedPieceId);
    // this line makes sure, that selectedPieces (piece ids of joined players)
    // is always in rainbow order:
    game.selectedPieces.sort(rainbowSort);

    game.joinedPlayers[gameSocket.id] = data.selectedPieceId;
    game.playerNames[data.selectedPieceId] = data.playerName;

    // first player that selects a piece becomes "game master":
    if (game.selectedPieces.length == 1) {
      game.gameMaster = data.selectedPieceId;
    }

    io.sockets.in(data.gameId).emit("add player", {
      socketId: data.socketId,
      selectedPieceId: data.selectedPieceId,
      playerName: data.playerName,
      gameMaster: game.gameMaster
    });
  }
}

function changeLanguage(data) {
  let game = gameStates[data.gameId];
  if (data.newLanguage == "german") {
    game.cards = cardsDE;
    game.chosenLanguage = "german";
  } else if (data.newLanguage == "english") {
    game.cards = cardsEN;
    game.chosenLanguage = "english";
  }

  io.sockets.in(data.gameId).emit("language has been changed", data.newLanguage);
}

function gameStarted(data) {
  let game = gameStates[data.gameId];
  // game.currentPlayer = data.startPlayer;
  game.currentPlayer = getStartPlayer(data.gameId);

  // this line makes sure, that selectedPieces (joined players) is in the correct order, like the player pieces are rendered (in a beautiful rainbow order):
  // selectedPieces = data.joinedPlayerIds;
  game.selectedPieces.sort(rainbowSort);
  console.log("joined players at game start: ", game.selectedPieces);

  // set number of turns:
  if (game.selectedPieces.length == 3 || game.selectedPieces.length == 5) {
    game.numberOfTurnsLeft = 15;
  } else if (game.selectedPieces.length == 4) {
    game.numberOfTurnsLeft = 12;
  } else if (game.selectedPieces.length == 6) {
    game.numberOfTurnsLeft = 18;
  } else if (game.selectedPieces.length == 7) {
    game.numberOfTurnsLeft = 14;
  } else if (game.selectedPieces.length == 8) {
    game.numberOfTurnsLeft = 16;
  }
  game.numberOfTurnsForThisGame = game.numberOfTurnsLeft;

  console.log(
    `${game.selectedPieces.length} players joined the game.
    Each player will be the builder ${game.numberOfTurnsLeft / game.selectedPieces.length} times!`
  );

  game.discardPile = game.cards;
  // discard pile gets shuffled and builds the new stuffCards pile:
  shuffleCards(data.gameId);
  // drawCard(stuffCards);
  game.firstCard = game.stuffCards.shift();

  game.playerPointsTotal = {};
  for (let i = 0; i < game.selectedPieces.length; i++) {
    game.playerPointsTotal[game.selectedPieces[i]] = 0;
  }

  game.correctAnswer = randomNumber(1, 7);
  game.guessedAnswers = {};
  game.answeringOrder = [];
  game.gameStarted = true;
  game.doneBtnPressed = false;
  game.guessingOrDiscussionTime = false;

  let msg = `"${game.currentPlayer}" starts with building!`;

  game.activeObjects = data.activeObjects;
  game.queuedObjects = data.queuedObjects;

  io.sockets.in(data.gameId).emit("game has been started", {
    message: msg,
    startPlayer: game.currentPlayer,
    activeObjects: data.activeObjects,
    queuedObjects: data.queuedObjects,
    firstCard: game.firstCard,
    correctAnswer: game.correctAnswer,
    numberOfTurnsLeft: game.numberOfTurnsLeft
  });
}

function onDisconnect() {
  let socket = this;
  console.log(`socket with the id ${socket.id} is now disconnected`);
  // NOTE: for some reason, this event only fires, when the browser is refreshed; not if it just lost internet connection? --> seems to be delayed, so players will be removed after disconnecting after they actually rejoined :(

  let myGameId;
  // to find the gameId of the disconnected socket:
  // check every open game, if the disconnected socket was a joined player:
  for (let gameId in gameStates) {
    let game = gameStates[gameId];
    // console.log(`joinedPlayers in ${gameId}:`);
    // for (var prop in game.joinedPlayers) {
    //   console.log(prop, game.joinedPlayers[prop]);
    // }
    if (game.joinedPlayers && Object.keys(game.joinedPlayers).length > 0) {
      let socketIdsArray = Object.keys(game.joinedPlayers);
      if (socketIdsArray.includes(socket.id)) {
        myGameId = gameId;
      }
    }
  }
  // if the socket was not a joined player, they could still be the game host:
  if (!myGameId) {
    for (let gameId in gameStates) {
      let game = gameStates[gameId];
      if (game.gameHost == socket.id) {
        myGameId = gameId;
      }
    }
  }
  // if the disconnected socket was either a player or the game host
  // (and not just someone entering the game room but not selecting a color
  // and not taking part of the actual game...):
  if (myGameId) {
    let game = gameStates[myGameId];
    // if the disconnected socket was the game host:
    if (socket.id == game.gameHost) {
      // at the current state of the game, the host screen is only informative
      // but not necessary. the host is only required to deliver the room code
      // and start the game.
      // So if the host disconnects, the players can continue playing the game.
      // but let's set the gameHost prop in the gameStates object to ""
      // just to be able to check later, if the game still has it's host
      game.gameHost = "";

      let room = gameSocket.adapter.rooms[myGameId];
      // console.log('room:', room);
      let socketsLeft = 0;
      if (room) {
        socketsLeft = room.length;
      }
      console.log(`The game host left the room and there are ${socketsLeft} sockets in the room left.`);
      // if there are no players and no host left in the room,
      // remove the game from the gameStates object:
      if (!socketsLeft) {
        delete gameStates[myGameId];
      }

      // TODO: when the game that lost it's host ends, I might wanna try this:
      // io.sockets.in(myGameId).leave(myGameId);
      // to delete this room
    } else {
      // if the disconnected socket was a player (not the host):
      console.log(`The disconnected socket ${socket.id} has been a player in game room ${myGameId}.`);

      let pieceId = game.joinedPlayers[socket.id];

      if (pieceId == game.gameMaster) {
        // if disconnected player is the game master, the next joined player in rainbow order becomes game master:
        game.gameMaster = getNextPlayer(myGameId, pieceId);

        // TODO: add event in the app.js
        console.log('new game master!');
        io.sockets.in(myGameId).emit("new game master", {
          oldGameMaster: pieceId,
          newGameMaster: game.gameMaster
        });
      }

      game.selectedPieces = game.selectedPieces.filter(item => item !== pieceId);
      if (game.selectedPieces.length == 0) {
        game.gameStarted = false;
        // TODO: reset the game/the host screen to the start menu (given the host is still connected)
      } else if (game.selectedPieces.length == 1) {
        // TODO: end the game and tell the remaining player they win because everybody else left.
      }
      if (pieceId) {
        console.log(`player piece "${pieceId}" in game ${myGameId} is now free again`);

        io.sockets.in(myGameId).emit("remove selected piece", pieceId);
        delete game.joinedPlayers[socket.id];
        delete game.playerNames[pieceId];
        delete game.playerPointsTotal[pieceId];
      }
    } // else: if the disconnected socket was a player (not the host)
  } // if myGameId
}

// /**
//  * A player has tapped a word in the word list.
//  * @param data gameId
//  */
// function playerAnswer(data) {
//   // console.log('Player ID: ' + data.playerId + ' answered a question with: ' + data.answer);
//
//   // The player's answer is attached to the data object.  \
//   // Emit an event with the answer so it can be checked by the 'Host'
//   io.sockets.in(data.gameId).emit("hostCheckAnswer", data);
// }
//
// /**
//  * The game is over, and a player has clicked a button to restart the game.
//  * @param data
//  */
// function playerRestart(data) {
//   // console.log('Player: ' + data.playerName + ' ready for new game.');
//
//   // Emit the player's data back to the clients in the game room.
//   data.playerId = this.id;
//   io.sockets.in(data.gameId).emit("playerJoinedRoom", data);
// }

/* *************************
 *                       *
 *      GAME LOGIC       *
 *                       *
 ************************* */

// /**
//  * Get a word for the host, and a list of words for the player.
//  *
//  * @param wordPoolIndex
//  * @param gameId The room identifier
//  */
// function sendWord(wordPoolIndex, gameId) {
//   var data = getWordData(wordPoolIndex);
//   io.sockets.in(gameId).emit("newWordData", data);
// }

// /**
//  * This function does all the work of getting a new words from the pile
//  * and organizing the data to be sent back to the clients.
//  *
//  * @param i The index of the wordPool.
//  * @returns {{round: *, word: *, answer: *, list: Array}}
//  */
// function getWordData(i) {
//   // Randomize the order of the available words.
//   // The first element in the randomized array will be displayed on the host screen.
//   // The second element will be hidden in a list of decoys as the correct answer
//   var words = shuffleArray(wordPool[i].words);
//
//   // Randomize the order of the decoy words and choose the first 5
//   var decoys = shuffleArray(wordPool[i].decoys).slice(0, 5);
//
//   // Pick a random spot in the decoy list to put the correct answer
//   var rnd = Math.floor(Math.random() * 5);
//   decoys.splice(rnd, 0, words[1]);
//
//   // Package the words into a single object.
//   var wordData = {
//     round: i,
//     word: words[0], // Displayed Word
//     answer: words[1], // Correct Answer
//     list: decoys // Word list for player (decoys and answer)
//   };
//
//   return wordData;
// }

function rainbowSort(a, b) {
  let rainbow = ['grey', 'purple', 'blue', 'green', 'yellow', 'orange', 'red', 'pink'];
  return rainbow.indexOf(a) - rainbow.indexOf(b);
}

// Javascript implementation of Fisher-Yates shuffle algorithm:
function shuffleArray(array) {
  //shuffles array in place
  let j, x, i;
  for (i = array.length - 1; i > 0; i--) {
    j = Math.floor(Math.random() * (i + 1));
    x = array[i];
    array[i] = array[j];
    array[j] = x;
  }
  return array;
}

function shuffleCards(gameId) {
  let game = gameStates[gameId];
  let cards = game.discardPile;
  //shuffles array in place:
  game.stuffCards = shuffleArray(cards);
  game.discardPile = [];
}

function getNextPlayer(gameId, pieceId) {
  let selectedPieces = gameStates[gameId].selectedPieces;
  let currentPlayerIndex = selectedPieces.indexOf(pieceId);

  let nextPlayer;
  if (selectedPieces.length > 1) {
    if (selectedPieces[currentPlayerIndex + 1]) {
      nextPlayer = selectedPieces[currentPlayerIndex + 1];
    } else {
      nextPlayer = selectedPieces[0];
    }
  } else {
    nextPlayer = "";
    console.log('there is no other player left to get the next one..');
  }
  return nextPlayer;
}

function getStartPlayer(gameId) {
  let game = gameStates[gameId];
  let startPlayerId = randomNumber(0, game.selectedPieces.length);
  return game.selectedPieces[startPlayerId];
}

// Function to generate random number, min incl, max excl.
function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

// /**
//  * Each element in the array provides data for a single round in the game.
//  *
//  * In each round, two random "words" are chosen as the host word and the correct answer.
//  * Five random "decoys" are chosen to make up the list displayed to the player.
//  * The correct answer is randomly inserted into the list of chosen decoys.
//  *
//  * @type {Array}
//  */
// var wordPool = [
//   {
//     words: ["sale", "seal", "ales", "leas"],
//     decoys: [
//       "lead",
//       "lamp",
//       "seed",
//       "eels",
//       "lean",
//       "cels",
//       "lyse",
//       "sloe",
//       "tels",
//       "self"
//     ]
//   },
//
//   {
//     words: ["item", "time", "mite", "emit"],
//     decoys: [
//       "neat",
//       "team",
//       "omit",
//       "tame",
//       "mate",
//       "idem",
//       "mile",
//       "lime",
//       "tire",
//       "exit"
//     ]
//   },
//
//   {
//     words: ["spat", "past", "pats", "taps"],
//     decoys: [
//       "pots",
//       "laps",
//       "step",
//       "lets",
//       "pint",
//       "atop",
//       "tapa",
//       "rapt",
//       "swap",
//       "yaps"
//     ]
//   },
//
//   {
//     words: ["nest", "sent", "nets", "tens"],
//     decoys: [
//       "tend",
//       "went",
//       "lent",
//       "teen",
//       "neat",
//       "ante",
//       "tone",
//       "newt",
//       "vent",
//       "elan"
//     ]
//   },
//
//   {
//     words: ["pale", "leap", "plea", "peal"],
//     decoys: [
//       "sale",
//       "pail",
//       "play",
//       "lips",
//       "slip",
//       "pile",
//       "pleb",
//       "pled",
//       "help",
//       "lope"
//     ]
//   },
//
//   {
//     words: ["races", "cares", "scare", "acres"],
//     decoys: [
//       "crass",
//       "scary",
//       "seeds",
//       "score",
//       "screw",
//       "cager",
//       "clear",
//       "recap",
//       "trace",
//       "cadre"
//     ]
//   },
//
//   {
//     words: ["bowel", "elbow", "below", "beowl"],
//     decoys: [
//       "bowed",
//       "bower",
//       "robed",
//       "probe",
//       "roble",
//       "bowls",
//       "blows",
//       "brawl",
//       "bylaw",
//       "ebola"
//     ]
//   },
//
//   {
//     words: ["dates", "stead", "sated", "adset"],
//     decoys: [
//       "seats",
//       "diety",
//       "seeds",
//       "today",
//       "sited",
//       "dotes",
//       "tides",
//       "duets",
//       "deist",
//       "diets"
//     ]
//   },
//
//   {
//     words: ["spear", "parse", "reaps", "pares"],
//     decoys: [
//       "ramps",
//       "tarps",
//       "strep",
//       "spore",
//       "repos",
//       "peris",
//       "strap",
//       "perms",
//       "ropes",
//       "super"
//     ]
//   },
//
//   {
//     words: ["stone", "tones", "steno", "onset"],
//     decoys: [
//       "snout",
//       "tongs",
//       "stent",
//       "tense",
//       "terns",
//       "santo",
//       "stony",
//       "toons",
//       "snort",
//       "stint"
//     ]
//   }
// ];
