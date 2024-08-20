const cryptoRandomString = require("crypto-random-string");

const cardsEN = require("./cards_enUS.json");
const cardsDE = require("./cards_de.json");

// for writing server-logs:
const fs = require('fs');

var io;
var gameSocket;
const gameStates = {};

const logMessage = (message) => {
  console.log(message);
  // TODO: how can I look at this playedgames.log file in heroku?
  // let stream = fs.createWriteStream("playedgames.log", {flags:'a'});
  // stream.write(message);
  // stream.end();
}
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

  gameSocket.on("changed object image", onChangedObjectImg);
  gameSocket.on("moving objects", onMovingObjects);
  gameSocket.on("dropping object", onDroppingObject);
  gameSocket.on("done building", onDoneBuilding);

  gameSocket.on("skip card", onSkipCard);
  gameSocket.on("made a guess", onMadeAGuess);
  gameSocket.on("guesses backup", onGuessesBackup);
  gameSocket.on("objects for next turn", onObjectsForNextTurn);

  // ending the game pressing "O" (only in testing mode):
  gameSocket.on("end game", endGame);

  gameSocket.on("disconnect", onDisconnect);
  gameSocket.on("let me rejoin the game", onRejoinRequest);

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
  const gameIdsArray = Object.keys(gameStates);
  let thisGameId;
  do {
    thisGameId = cryptoRandomString({
      length: 4,
      characters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    });
    // generate new game IDs as long as the generated ID is already in use:
  } while (gameIdsArray.includes(thisGameId));

  let socket = this;

  // initiate game state:
  initiateGameState(thisGameId, socket.id);

  // Return the Room ID (gameId) and the socket ID (mySocketId) to the browser client
  socket.emit("newGameCreated", { gameId: thisGameId, mySocketId: socket.id });

  // Join the Room and wait for the players
  socket.join(thisGameId.toString());

  // write server log:
  // TODO: format date with "moment" like in imageboard sloths?
  const message = `Game "${thisGameId}" created at ${new Date().toLocaleString()}\n`;
  logMessage(message);
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
    everyoneGuessed: false,
    cardPointsHTML: "",

    // active and queued objects:
    activeObjects: "",
    queuedObjects: "",
    joinedPlayersHTML: "",
    buildersViewportWidth: "",
    dataForNextTurn: {}
  };
}

/* **********************************
 *                                  *
 *     PLAYER EVENT FUNCTIONS       *
 *                                  *
 ********************************** */

/**
 * A player clicked the 'play' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */
function playerJoinsRoom(data) {
  // logMessage('Player ' + data.playerName + ' attempting to join game room: ' + data.gameId ); // Debugging info

  // A reference to the player's Socket.IO socket object
  let socket = this;

  // Look up the room ID in the Socket.IO adapter object.
  // let room = gameSocket.adapter.rooms[data.gameId]; // not working anymore, structure changed
  let room = gameSocket.adapter.rooms.get(data.gameId); // Updated to use Map's get method

  // If the room exists...
  if (room && room.size > 0) { // Check if room exists and has sockets
    // attach the socket id to the data object.
    data.mySocketId = socket.id;

    let gameId = data.gameId;

    // Join the room
    socket.join(gameId);
    logMessage('Player ' + data.playerName + ' joining game room: ' + gameId); // Debugging info

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
  let game = gameStates[data.gameId];

  // in case two players choose the same piece at almost the same time:
  // check if the requested piece add is not already chosen by another player:
  if (data.selectedPieceId && !game.selectedPieces.includes(data.selectedPieceId)) {
    // console.log(
    //   `Player '${data.playerName}' joined the game ${data.gameId} with the color ${data.selectedPieceId}.`
    // );

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
  // console.log("joined players at game start: ", game.selectedPieces);

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

  // console.log(
  //   `${game.selectedPieces.length} players joined the game.
  //   Each player will be the builder ${game.numberOfTurnsLeft / game.selectedPieces.length} times!`
  // );

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
  game.everyoneGuessed = false;

  let msg = `"${game.currentPlayer}" starts with building!`;

  game.joinedPlayersHTML = data.joinedPlayersHTML;
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

  // write server log:
  const activePlayers = game.playerNames;
  let playerString = "";
  for (const color in activePlayers) {
    playerString += `${activePlayers[color]} (${color}), `
  }
  playerString = playerString.slice(0, -2); 
  const message = `Game "${data.gameId}" started at ${new Date().toLocaleString()}\n\tplayers: ${playerString}\n`;
  logMessage(message);
}

function onChangedObjectImg(data) {
  io.sockets.in(data.gameId).emit("object image changed", {
    clickedImgId: data.clickedImgId,
    newPicSrc: data.newPicSrc,
    removeClass: data.removeClass,
    addClass: data.addClass
  });
}

function onMovingObjects(data) {
  let game = gameStates[data.gameId];
  game.activeObjects = data.activeObjects;
  game.buildersViewportWidth = data.viewportWidth;

  io.sockets.in(data.gameId).emit("objects are moving", {
    activePlayer: data.activePlayer,
    activeObjects: data.activeObjects,
    buildersViewportWidth: data.viewportWidth,
    clickedImgId: data.clickedImgId,
    moveXvw: data.moveXvw,
    moveYvw: data.moveYvw,
    transformRotate: data.transformRotate
  });
}

function onDroppingObject(data) {
  io.sockets.in(data.gameId).emit("object dropped", {
    activePlayer: data.activePlayer,
    clickedImgId: data.clickedImgId,
    selected: data.selected
  });
}

function onDoneBuilding(data) {
  let game = gameStates[data.gameId];
  game.activeObjects = data.activeObjects;
  // game.queuedObjects = data.queuedObjects;
  let msg = `player "${data.activePlayer}" finished building! Guess what it is!`;
  game.doneBtnPressed = true;
  io.sockets.in(data.gameId).emit("building is done", {
    message: msg,
    activePlayer: data.activePlayer,
    activeObjects: data.activeObjects,
    buildersViewportWidth: data.buildersViewportWidth
  });
}

function onSkipCard(gameId) {
  let game = gameStates[gameId];
  replaceCard(gameId);
  game.correctAnswer = randomNumber(1, 7);
  io.sockets.in(gameId).emit("next card", {
    newCard: game.firstCard,
    correctAnswer: game.correctAnswer
  });
}

function onMadeAGuess(data) {
  let game = gameStates[data.gameId];
  // collect guesses:
  game.guessedAnswers[data.guessingPlayer] = data.guessedItem;
  game.answeringOrder.push(data.guessingPlayer);

  let guessedAnswersLength = Object.keys(game.guessedAnswers).length;
  let joinedPlayersLength = game.selectedPieces.length;

  io.sockets.in(data.gameId).emit("someone guessed", {
    guessingPlayer: data.guessingPlayer,
    guessedItem: data.guessedItem
  });

  // when everyone guessed: add points:
  if (guessedAnswersLength == joinedPlayersLength - 1) {
    game.everyoneGuessed = true;
    let playerPointsIfCorrect = {};
    let actualPlayerPoints = {};
    let numberOfCorrectGuesses = 0;

    if (joinedPlayersLength <= 6) {
      // points for up to 6 players (5 guessers):
      let pointsCounter = game.answeringOrder.length;
      for (let i = 0; i < game.answeringOrder.length; i++) {
        playerPointsIfCorrect[game.answeringOrder[i]] = pointsCounter;
        if (game.guessedAnswers[game.answeringOrder[i]] == game.correctAnswer) {
          actualPlayerPoints[game.answeringOrder[i]] = pointsCounter;
          game.playerPointsTotal[game.answeringOrder[i]] += pointsCounter;
          numberOfCorrectGuesses++;
        } else {
          actualPlayerPoints[game.answeringOrder[i]] = 0;
        }
        pointsCounter--;
      }
    } else if (joinedPlayersLength > 6) {
      // for more than 6 players (max 8): (6-7 guessers):
      // maximum points: 5
      let pointsCounter = 0;
      for (let i = game.answeringOrder.length; i > 0; i--) {
        playerPointsIfCorrect[game.answeringOrder[i]] = pointsCounter;
        if (game.guessedAnswers[game.answeringOrder[i]] == game.correctAnswer) {
          actualPlayerPoints[game.answeringOrder[i]] = pointsCounter;
          game.playerPointsTotal[game.answeringOrder[i]] += pointsCounter;
          numberOfCorrectGuesses++;
        } else {
          actualPlayerPoints[game.answeringOrder[i]] = 0;
        }
        if (pointsCounter < 5) {
          pointsCounter++;
        }
      }
    }
    // building player gets 1 point for each correct guess:
    game.playerPointsTotal[game.currentPlayer] += numberOfCorrectGuesses;

    game.dataForNextTurn = {
      activePlayer: game.currentPlayer,
      correctAnswer: game.correctAnswer,
      guessedAnswers: game.guessedAnswers,
      playerPointsIfCorrect: playerPointsIfCorrect,
      actualPlayerPoints: actualPlayerPoints,
      playerPointsTotal: game.playerPointsTotal
    };

    io.sockets.in(data.gameId).emit("everyone guessed", game.dataForNextTurn);
  }
}

function onGuessesBackup(data) {
  let game = gameStates[data.gameId];
  game.cardPointsHTML = data.cardPointsHTML;
}

function onObjectsForNextTurn(data) {
  let game = gameStates[data.gameId];
  game.joinedPlayersHTML = data.joinedPlayersHTML;
  game.numberOfTurnsLeft--;
  if (game.numberOfTurnsLeft == 0) {
    endGame(data.gameId);
  } else {
    nextPlayersTurn(data);
  }
}

function endGame(gameId) {
  let game = gameStates[gameId];
  // get winner:
  let ranking = [];
  for (let player in game.playerPointsTotal) {
    let name = game.playerNames[player];
    let playerPointsObj = {
      player: player,
      name: name,
      points: game.playerPointsTotal[player]
    };
    ranking.push(playerPointsObj);
  }

  // sort array in place by points, descending:
  ranking.sort(function(a, b) {
    return b.points - a.points;
  });
  
  // console.log("game over!");
  io.sockets.in(gameId).emit("game ends", {
    joinedPlayersHTML: game.joinedPlayersHTML,
    rankingArray: ranking
  });
  
  // write server log:
  let rankingString = "";
  for (let i = 0; i < ranking.length; i++) {
    rankingString += `${ranking[i].name} (${ranking[i].points}), `;
  }
  rankingString = rankingString.slice(0, -2); 
  const message = `Game "${gameId}" endet at ${new Date().toLocaleString()}\n\tranking: ${rankingString}\n`;
  logMessage(message);

  // reset selectedPieces for next game:
  game.selectedPieces = [];
  game.gameStarted = false;
}

/* *************************
 *                       *
 *      GAME LOGIC       *
 *                       *
 ************************* */

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
    // console.log('there is no other player left to get the next one..');
  }
  return nextPlayer;
}

function getStartPlayer(gameId) {
  let game = gameStates[gameId];
  let startPlayerId = randomNumber(0, game.selectedPieces.length);
  return game.selectedPieces[startPlayerId];
}

function nextPlayersTurn(data) {
  let game = gameStates[data.gameId];
  let nextPlayer = getNextPlayer(data.gameId, data.activePlayer);
  game.currentPlayer = nextPlayer;

  replaceCard(data.gameId);
  game.correctAnswer = randomNumber(1, 7);
  game.guessedAnswers = {};
  game.answeringOrder = [];

  game.activeObjects = data.activeObjects;
  game.queuedObjects = data.queuedObjects;

  game.doneBtnPressed = false;
  game.everyoneGuessed = false;

  io.sockets.in(data.gameId).emit("next turn", {
    activePlayer: data.activePlayer,
    nextPlayer: nextPlayer,
    activeObjects: data.activeObjects,
    queuedObjects: data.queuedObjects,
    newCard: game.firstCard,
    correctAnswer: game.correctAnswer,
    numberOfTurnsLeft: game.numberOfTurnsLeft
  });
}

function replaceCard(gameId) {
  let game = gameStates[gameId];
  // discardCard();
  // discard current card:
  if (game.newPile === false) {
    game.discardPile.push(game.firstCard);
  }

  if (game.stuffCards.length > 0) {
    game.newPile = false;
    // drawCard(stuffCards);
    game.firstCard = game.stuffCards.shift();
  } else {
    // discard pile gets shuffled and builds the new stuffCards pile:
    shuffleCards(gameId);
    // drawCard(stuffCards);
    game.firstCard = game.stuffCards.shift();
    game.newPile = true;
  }
}

// Function to generate random number, min incl, max excl.
function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function onDisconnect() {
  let socket = this;
  // console.log(`socket with the id ${socket.id} is now disconnected`);

  // NOTE: for some reason, this event only fires, when the browser is refreshed; not if it just lost internet connection? --> seems to be delayed, so players will be removed after disconnecting after they actually rejoined :(

  let myGameId;
  // to find the gameId of the disconnected socket:
  // check every open game, if the disconnected socket was a joined player:
  for (let gameId in gameStates) {
    let game = gameStates[gameId];
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
      // console.log(`The game host left the room and there are ${socketsLeft} sockets in the room left.`);
      
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
      // console.log(`The disconnected socket ${socket.id} has been a player in game room ${myGameId}.`);

      let pieceId = game.joinedPlayers[socket.id];

      if (pieceId == game.gameMaster) {
        // if disconnected player is the game master, the next joined player in rainbow order becomes game master:
        game.gameMaster = getNextPlayer(myGameId, pieceId);

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
        // console.log(`player piece "${pieceId}" in game ${myGameId} is now free again`);

        io.sockets.in(myGameId).emit("remove player", pieceId);
        delete game.joinedPlayers[socket.id];
        delete game.playerNames[pieceId];
        delete game.playerPointsTotal[pieceId];
      }
    } // else: if the disconnected socket was a player (not the host)
  } // if myGameId
}

function onRejoinRequest(data) {
  // one player got disconnected and needs all the info back to rejoin the game.
  let socket = this;
  // console.log('rejoining socketId:', socket.id);
  let game = gameStates[data.gameId];

  if (game && game.gameStarted) {
    // Join the Room and wait for the players
    socket.join(data.gameId);
    game.selectedPieces.push(data.selectedPieceId);
    // console.log('selectedPieces after rejoining:', game.selectedPieces);
    // NOTE: depending on the disconnection (intenet failure / page refresh) there might be double entries in the selected pieces array (because they don't get deleted on "disconnect").. so:
    // NOTE: update: the selected piece WILL get deleted on internet disconnection, BUT: in this case it happens a long time after the same player rejoined the game already.. how do I solve this problem? the rejoining player shouldn't get deleted..
    game.selectedPieces = [...new Set(game.selectedPieces)];
    // console.log('selectedPieces after filtering double entries:', game.selectedPieces);
    // now the player piece order is destroyed.. so after someone disconnects/reconnets, resort in rainbow pattern:
    game.selectedPieces.sort(rainbowSort);
    // console.log('selectedPieces after rainbowSort:', game.selectedPieces);

    game.joinedPlayers[socket.id] = data.selectedPieceId;
    game.playerNames[data.selectedPieceId] = data.playerName;
    game.playerPointsTotal[data.selectedPieceId] = data.myTotalPoints;
    addPlayerMidGame(data);
  }
}

function addPlayerMidGame(data) {
  // console.log(
  //   `${data.playerName} rejoined the game ${data.gameId} with the color ${data.selectedPieceId}`
  // );
  let game = gameStates[data.gameId];
  io.sockets.in(data.gameId).emit("add player midgame", {
    selectedPieceId: data.selectedPieceId,
    playerName: data.playerName,
    playerPointsTotal: game.playerPointsTotal,
    gameMaster: game.gameMaster,
    selectedPieces: game.selectedPieces,
    playerNames: game.playerNames,
    chosenLanguage: game.chosenLanguage,
    activePlayer: game.currentPlayer,
    numberOfTurnsForThisGame: game.numberOfTurnsForThisGame,
    numberOfTurnsLeft: game.numberOfTurnsLeft,
    firstCard: game.firstCard,
    correctAnswer: game.correctAnswer,
    guessedAnswers: game.guessedAnswers,
    everyoneGuessed: game.everyoneGuessed,
    joinedPlayersHTML: game.joinedPlayersHTML,
    activeObjects: game.activeObjects,
    queuedObjects: game.queuedObjects,
    buildersViewportWidth: game.buildersViewportWidth,
    doneBtnPressed: game.doneBtnPressed,
    cardPointsHTML: game.cardPointsHTML,
    dataForNextTurn: game.dataForNextTurn
  });
}
