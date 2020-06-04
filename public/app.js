jQuery(
  (function($) {
    // "use strict";

    /**
     * All the code relevant to Socket.IO is collected in the IO namespace.
     *
     * @type {{init: Function, bindEvents: Function, onConnected: Function, onNewGameCreated: Function, onPlayerJoinedRoom: Function, onBeginNewGame: Function, onNewWordData: Function, hostCheckAnswer: Function, gameOver: Function, errorMessage: Function}}
     */
    var IO = {
      /**
       * This is called when the page is displayed. It connects the Socket.IO client
       * to the Socket.IO server
       */
      init: function() {
        // 'io' is actually not undefined:
        IO.socket = io.connect();
        IO.bindEvents();
      },

      /**
       * While connected, Socket.IO will listen to the following events emitted
       * by the Socket.IO server, then run the appropriate function.
       */
      bindEvents: function() {
        IO.socket.on("connected", IO.onConnected);
        IO.socket.on("newGameCreated", IO.onNewGameCreated);
        // IO.socket.on("beginNewGame", IO.onBeginNewGame);
        IO.socket.on("playerJoinedRoom", IO.onPlayerJoinedRoom);
        IO.socket.on("errorMessage", IO.errorMessage);
        IO.socket.on("welcome", IO.onWelcome);
        IO.socket.on("add player", IO.onAddPlayer);
        IO.socket.on("language has been changed", App.languageHasBeenChanged);
        IO.socket.on("remove selected piece", IO.onRemovePlayer);
        IO.socket.on("new game master", IO.onNewGameMaster);
        IO.socket.on("game has been started", IO.onGameHasBeenStarted);

        // IO.socket.on("newWordData", IO.onNewWordData);
        // IO.socket.on("hostCheckAnswer", IO.hostCheckAnswer);
        // IO.socket.on("gameOver", IO.gameOver);
      },

      /**
       * The client is successfully connected!
       */
      onConnected: function(data) {
        // Cache a copy of the client's socket.IO session ID on the App
        // App.mySocketId = IO.socket.socket.sessionid;
        App.mySocketId = IO.socket.id;
        // console.log('my socket id:', IO.socket.id);
        console.log(data.message);
      },

      /**
       * A new game has been created and a random game ID has been generated.
       * @param data {{ gameId: string, mySocketId: * }}
       */
      onNewGameCreated: function(data) {
        App.Host.gameInit(data);
      },

      /**
       * A player has successfully joined the game.
       * @param data {{playerName: string, gameId: string, mySocketId: *}}
       */
      onPlayerJoinedRoom: function(data) {
        // When a player joins a room, do the updateWaitingScreen function.
        // There are two versions of this function: one for the 'host' and
        // another for the 'player'.
        //
        // So on the 'host' browser window, the App.Host.updateWaitingScreen function is called.
        // And on the player's browser, App.Player.updateWaitingScreen is called.
        App[App.myRole].updateWaitingScreen(data);
      },

      // /**
      //  * Both players have joined the game.
      //  * @param data
      //  */
      // onBeginNewGame: function(data) {
      //   App[App.myRole].displayStartMenu(data);
      //   console.log('begin new game...');
      // },

      onWelcome: function(data) {
        sessionStorage.setItem("mySocketId", data.socketId);
        App.mySocketId = data.socketId;
        console.log("Welcome to AllThatStuff!");

        // set language of word cards:
        if (App.chosenLanguage != data.chosenLanguage) {
          App.languageHasBeenChanged(data.chosenLanguage);
        }

        // check if the game has already started:
        App.gameStarted = data.gameStarted;
        if (!App.gameStarted) {

          // remember previously selected piece on page reload:
          if (App.selectedPieceId && App.myPlayerName) {
            // TODO In case of a replay, I should also check here, if the selected piece has been taken by a new player in the meantime....
            App.Player.selectedPiece(App.selectedPieceId);
          }
        } else {
          // if the game has already started:
          if (App.selectedPieceId && App.myPlayerName) {
            // e.g. if a joined player disconnected unintentionally and reconnects mid game..
            // TODO: add rejoin event in game.js
            IO.socket.emit("let me rejoin the game", {
              selectedPieceId: App.selectedPieceId,
              playerName: App.myPlayerName,
              myTotalPoints: App.myTotalPoints
            });
          } else {
            // if the player is new player and didn't join the game before
            setTimeout(() => {
              window.alert("game has already started, please try again later");
            }, 200);
          }
        }

        App.gameMaster = data.gameMaster;

        App.players = data.selectedPieces;
        App.playerNames = data.playerNames;

        // console.log('players in onWelcome(): ', App.players);
        let players = App.players;
        for (let i = 0; i < players.length; i++) {
          let $piece = $("#start-menu").find("#" + players[i]);
          let $playerName = $piece.find(".player-name");
          $playerName[0].innerText = App.playerNames[players[i]];
          $piece.addClass("selectedPlayerPiece");
          App.adjustNameFontSize($piece, $playerName[0].innerText);

          if (players[i] == App.gameMaster) {
            let $crown = $piece.find(".crown");
            $crown.removeClass("hidden");
          }
        }
      },

      onAddPlayer: function(data) {
        if (data.selectedPieceId && data.playerName) {
          // the first player who selects a piece, becomes game master:
          App.gameMaster = data.gameMaster;
          App.players.push(data.selectedPieceId);

          let $piece = $("#start-menu").find("#" + data.selectedPieceId);
          $piece.addClass("selectedPlayerPiece");

          if (data.selectedPieceId == App.gameMaster) {
            let $crown = $piece.find(".crown");
            $crown.removeClass("hidden");
          }

          let $playerName = $piece.find(".player-name");
          $playerName[0].innerText = data.playerName;
          App.adjustNameFontSize($piece, data.playerName);
          // App.doTextFit(".player-name");

          // if it was me, selecting a piece:
          if (data.selectedPieceId == App.selectedPieceId) {
            $piece.addClass("myPiece");

            // if I'm the game master:
            if (data.gameMaster == App.selectedPieceId && !App.iAmTheGameMaster) {
              App.iAmTheGameMaster = true;
              console.log("you are the game master");
              $("#chosen-language").addClass("game-master");
              $("#chosen-language").find(".crown").removeClass("hidden");

              let $buttonBox = $("#start-right").find(".buttonBox");
              // let $waitingMsg = $("#logo-box").find(".waiting-msg");
              $buttonBox.removeClass("hidden");
              // $waitingMsg.addClass("hidden");
            }
          }
        }
      },

      onRemovePlayer: function(pieceId) {
        let $piece = $("#" + pieceId);
        // console.log('$piece: ', $piece);

        $piece.removeClass("selectedPlayerPiece");
        // this will change the font color (to white) and border style (to dashed) of the player who left.

        // if the game has not started yet (still in the start menu), also reset the player name to "?".
        if (!App.gameStarted) {
          let $playerName = $piece.find(".player-name");
          // $playerName[0].innerText = "?";
          $playerName.text("?");
          $piece.removeClass("name4 name6 name8 name10 name12");
        }

        // in case he was the game master and the last remaining player, delete crown for the host player screen:
        let $crown = $piece.find(".crown");
        $crown.addClass("hidden");

        App.players = App.players.filter(item => item !== pieceId);
      },

      onNewGameMaster: function(data) {
        App.gameMaster = data.newGameMaster;
        $(`#${data.oldGameMaster}`).find('.crown').addClass('hidden');
        if (data.newGameMaster) {
          $(`#${data.newGameMaster}`).find('.crown').removeClass('hidden');
        }

        if (!App.gameStarted) {
          let $waitingMsg = $("#logo-box").find(".waiting-msg");
          // if I am the new game master:
          if (data.newGameMaster == App.selectedPieceId) {
            App.iAmTheGameMaster = true;
            $waitingMsg.addClass("hidden");
            let $buttonBox = $("#start-right").find(".buttonBox");
            $buttonBox.removeClass("hidden");
            $("#chosen-language").addClass("game-master");
            $('#chosen-language').find('.crown').removeClass('hidden');
          } else {
            // $waitingMsg.removeClass("hidden");
            // if I was the old game master:
            if (data.oldGameMaster == App.selectedPieceId) {
              // no change needed because I was the one that disconnected and the page is reloading/rerendered anyway...
            }
          }
        // if game started:
        } else {
          // if I am the new game master:
          if (data.newGameMaster == App.selectedPieceId) {
            App.iAmTheGameMaster = true;
            if (App.everyoneGuessed) {
              $("#next-btn").removeClass("hidden");
            }
          }
        }
      },

      onGameHasBeenStarted: function(data) {
        console.log('game has been started!');
      },

      // /**
      //  * Let everyone know the game has ended.
      //  * @param data
      //  */
      // gameOver: function(data) {
      //   App[App.myRole].endGame(data);
      // },

      /**
       * An error has occurred.
       * @param data
       */
      errorMessage: function(data) {
        window.alert(data.message);
      }
    };

    var App = {
      // gameId, identical to the ID of the Socket.IO Room
      // used for the players and host to communicate
      gameId: "",
      // This is used to differentiate between 'Host' and 'Player' browsers:
      myRole: "", // 'Player' or 'Host'
      /**
       * The Socket.IO socket object identifier. This is unique for
       * each player and host. It is generated when the browser initially
       * connects to the server when the page loads for the first time.
       */
      mySocketId: "",
      // A reference to the socket ID of the Host:
      hostSocketId: "",
      // The player's name entered on the 'Join' screen:
      // myName: sessionStorage.getItem("myName"),
      myName: "",
      // selectedPieceId: sessionStorage.getItem("selectedPieceId"),
      selectedPieceId: "",
      // myTotalPoints: parseInt(sessionStorage.getItem("myTotalPoints"), 10),
      myTotalPoints: 0,
      myGuess: "",

      players: [],
      playerNames: {},
      gameMaster: "",
      iAmTheGameMaster: false,
      activePlayer: "",
      itsMyTurn: false,

      chosenLanguage: "english",
      gameStarted: false,
      numberOfTurns: 0,
      /**
       * Flag to indicate if a new game is starting.
       * This is used after the first game ends, and players initiate a new game
       * without refreshing the browser windows.
       */
      isNewGame: false,

      doneBtnPressed: false,
      everyoneGuessed: false,
      correctAnswer: "",
      dataForNextTurn: {},

      viewportWidth: window.innerWidth,
      // to keep the ticker in the start menu moving
      // keep track of tickerObjects.offsetLeft:
      tickerOffsetLeft: 0,
      // and the animation id:
      myReq: "",

      /* *************************************
       *                Setup                *
       * *********************************** */

      /**
       * This runs when the page initially loads.
       */
      init: function() {
        App.cacheElements();
        App.showInitScreen();
        App.bindEvents();
        // Initialize the fastclick library
        // FastClick.attach(document.body);
      },

      /**
       * Create references to on-screen elements used throughout the game.
       */
      cacheElements: function() {
        App.$doc = $(document);

        // Templates
        App.$gameArea = $("#gameArea");
        App.$templateIntroScreen = $("#intro-screen-template").html();
        // App.$templateNewGame = $("#create-game-template").html();
        App.$templateJoinGame = $("#join-game-template").html();
        App.$templateHostStartMenu = $("#host-start-menu-template").html();
        App.$templatePlayerStartMenu = $("#player-start-menu-template").html();
        App.$templateMainGame = $("#main-game-template").html();
        // App.$templateHostGame = $("#host-game-template").html();

        // SOUNDS:
        App.ringDropSound = new Audio("./sounds/218823__djtiii__staple-drop.wav");
        App.universalDropSound = new Audio("./sounds/157539__nenadsimic__click.wav");
        App.startGong = new Audio("./sounds/56240__q-k__gong-center-clear.wav");
        App.doneGong = new Audio("./sounds/434627__dr-macak__ding.wav");
        App.successJingle = new Audio(
          "./sounds/270404__littlerobotsoundfactory__jingle-achievement-00.wav"
        );
        App.drumroll = new Audio("./sounds/12896__harri__circus-short.mp3");
        App.bubblePop1 = new Audio("./sounds/422813__pinto0lucas__bubble-low.wav");
        App.plop = new Audio("./sounds/431671__pellepyb__b1.ogg");

        App.uniSound = true;
        App.muted = false;
      },

      cacheElementsStartMenu: function() {
        App.selectPlayersContainer = document.getElementById("select-players");
        App.$startGameBtn = $("#startGame");

        // object ticker on start menu:
        App.objObj = [
          {
            name: "banana",
            images: "banana.png",
            sound: "405705__apinasaundi__found-matress-hit.wav"
          },
          {
            name: "bridge",
            images: ["bridge_v1.png", "bridge_v2.png", "bridge_v3.png"],
            sound: "146981__jwmalahy__thud1.wav"
          },
          {
            name: "cloth",
            images: ["cloth_v1.png", "cloth_v2.png", "cloth_v3.png"],
            sound: "128156__killpineapple__bagoffhead.mp3"
          },
          {
            name: "coin",
            images: ["coin_v1.png", "coin_v2.png"],
            sound: "140722__j1987__metalimpact-4.wav"
          },
          {
            name: "flower",
            images: ["flower_v1.png", "flower_v2.png"],
            sound: "240784__f4ngy__picking-flower.wav"
          },
          {
            name: "fur",
            images: "fur.png",
            sound: "128156__killpineapple__bagoffhead.mp3"
          },
          {
            name: "giant",
            images: ["giant_v1.png", "giant_v2.png", "giant_v3.png"],
            sound: "2516__jonnay__dropsine.wav"
          },
          {
            name: "peg",
            images: ["peg_v1.png", "peg_v2.png"],
            sound: "61086__andre-nascimento__floppy-disk01.wav"
          },
          {
            name: "pig",
            images: ["pig_v1.png", "pig_v2.png", "pig_v3.png"],
            sound: "442907__qubodup__pig-grunt.wav"
          },
          {
            name: "plane",
            images: ["plane_v1.png", "plane_v2.png", "plane_v3.png"],
            sound: "61086__andre-nascimento__floppy-disk01.wav"
          },
          {
            name: "pokerchip",
            images: "pokerchip.png",
            sound: "157539__nenadsimic__click.wav"
          },
          {
            name: "pole",
            images: "pole.png",
            sound: "61081__andre-nascimento__pen-on-floor02.wav"
          },
          {
            name: "puzzle",
            images: ["puzzle_v1.png", "puzzle_v2.png"],
            sound: "220018__chocktaw__fiji-meow-02.wav"
          },
          {
            name: "ring",
            images: ["ring_v1.png", "ring_v2.png"],
            sound: "218823__djtiii__staple-drop.wav"
          },
          {
            name: "rummikubtile",
            images: "rummikubtile.png",
            sound: "157539__nenadsimic__click.wav"
          },
          {
            name: "scissors",
            images: "scissors.png",
            sound: "48641__ohnoimdead__onid-scissor-snap.wav"
          },
          {
            name: "stone",
            images: "stone.png",
            sound: "146981__jwmalahy__thud1.wav"
          },
          {
            name: "ticket",
            images: "ticket.png",
            sound: "157539__nenadsimic__click.wav"
          },
          {
            name: "token",
            images: ["token_v1.png", "token_v2.png"],
            sound: "2516__jonnay__dropsine.wav"
          },
          {
            name: "triangle",
            images: "triangle.png",
            sound: "157539__nenadsimic__click.wav"
          }
        ];
        App.tickerObjects = document.getElementById("ticker-objects");
        App.objectList = App.tickerObjects.getElementsByClassName("img-box");
        // not using jQuery here because this way objectList stays in sync
        // objectList[0] is always the first link in the list
      },

      cacheElementsMainGame: function() {
        App.$objects = $("#objects");
        App.$queue = $("#queue");
        App.$joinedPlayersContainer = $("#joined-players");
        // card deck:
        App.cardTitle = document.getElementsByClassName("cardtitle");
        App.items = document.getElementsByClassName("item");
        App.$constructionArea = $("#construction-area");
        App.$rounds = $("#rounds");
        App.$message = $("#construction-area").find(".message");
        App.$instructions = $("#instructions");

        [App.borderTop, App.borderBottom, App.borderLeft, App.borderRight] = App.get$objBorders(
          App.$constructionArea
        );
        // for moving/drag&drop objects:
        App.objectClicked = false;
        App.objectMoved = false;
        App.$clickedImgBox;
        App.$clickedImgId;

        App.startX;
        App.startY;
        App.moveX;
        App.moveY;

        App.moveXvw;
        App.moveYvw;

        App.translateX;
        App.translateY;

        App.transformRotate = 0;
      },

      // bind click and event handlers:
      bindEvents: function() {
        // Host
        App.$doc.on("click", "#btnCreateGame", App.Host.onCreateClick);

        // Player
        App.$doc.on("click", "#btnJoinAGame", App.Player.onJoinAGameClick);
        App.$doc.on("click", "#btnJoin", App.Player.onPlayerJoinClick);

        // App.$doc.on("click", "#btnStart", App.Player.onPlayerStartClick);
        // App.$doc.on("click", ".btnAnswer", App.Player.onPlayerAnswerClick);
        // App.$doc.on("click", "#btnPlayerRestart", App.Player.onPlayerRestart);

        // Host & Players:
        $(window).on('resize', App.onWindowResize);
      },

      bindEventsStartMenu: function() {
        // Player
        $("#start-menu").on("click", ".player", App.Player.onPlayerColorClick);
        $("#chosen-language").on("click", App.Player.onLanguageClick);
        App.$startGameBtn.on("click", App.Player.onStartGameClick);
      },

      bindEventsJoinGame: function() {
        // Player
        $("#inputGameId").on("keydown", App.Player.onInputKeydown);
        $("#inputPlayerName").on("keydown", App.Player.onInputKeydown);
      },

      /* *************************************
       *             Game Logic              *
       * *********************************** */

      /**
       * Show the initial AllThatStuff Title Screen
       * (with Start and Join buttons)
       */
      showInitScreen: function() {
        App.$gameArea.html(App.$templateIntroScreen);
      },

      /* *******************************
       *         HOST CODE             *
       ******************************* */
      Host: {
        /**
         * Contains references to player data
         */
        connectedPlayers: [],

        /**
         * Handler for the "CREATE" button on the Title Screen.
         */
        onCreateClick: function() {
          // console.log('Clicked "Create A Game"');
          IO.socket.emit("hostCreateNewGame");
        },

        /**
         * The Host screen is displayed for the first time.
         * @param data{{ gameId: string, mySocketId: * }}
         */
        gameInit: function(data) {
          App.gameId = data.gameId;
          App.mySocketId = data.mySocketId;
          App.myRole = "Host";
          App.Host.numPlayersInRoom = 0;

          // App.Host.displayNewGameScreen();
          App.Host.displayStartMenu();
          // console.log("Game started with ID: " + App.gameId + ' by host: ' + App.mySocketId);
        },

        // /**
        //  * Show the Host screen containing the game URL and unique game ID
        //  */
        // displayNewGameScreen: function() {
        //   // Fill the game screen with the appropriate HTML
        //   App.$gameArea.html(App.$templateNewGame);
        //
        //   // Display the URL on screen
        //   $("#gameURL").text(window.location.href);
        //   // App.doTextFit("#gameURL");
        //
        //   // Show the gameId / room id on screen
        //   $("#spanNewGameCode").text(App.gameId);
        // },

        /**
         * Show the Host start menu screen containing the game URL and game ID
         */
        displayStartMenu: function() {
          // Fill the game screen with the appropriate HTML
          App.$gameArea.html(App.$templateHostStartMenu);
          App.cacheElementsStartMenu();
          App.preloadObjectImages();
          // Display the URL on screen
          // $("#gameURL").text(window.location.href);
          // Show the gameId / room id on screen
          $("#spanNewGameCode").text(App.gameId);

          App.shuffleTickerObjects(App.tickerObjects);
          // move objects ticker:
          App.tickerOffsetLeft = (App.tickerObjects.offsetLeft * 100) / App.viewportWidth;
          // => number (in px), x-position of element relative to its parent
          App.moveTickerObjects();
        },

        /**
         * Update the Host screen when the first player joins
         * @param data {{playerName: string}}
         */
        updateWaitingScreen: function(data) {
          // If this is a restarted game, show the screen.
          if (App.isNewGame) {
            // App.Host.displayNewGameScreen();
            App.Host.displayStartMenu();
          }
          // Update host screen
          // $("#playersWaiting")
          //   .append("<p/>")
          //   .text("Player " + data.playerName + " joined the game.");

          let message = `<p>${data.playerName} joined the game.</p>`;
          $("#playersWaiting").append(message);

          // Store the new player's data on the Host.
          App.Host.connectedPlayers.push(data);

          // Increment the number of players in the room
          App.Host.numPlayersInRoom += 1;

          // // If two players have joined, start the game!
          // if (App.Host.numPlayersInRoom === 2) {
          //   // console.log('Room is full. Almost ready!');
          //
          //   // Let the server know that two players are present.
          //   IO.socket.emit("hostRoomFull", App.gameId);
          // }
        }

        // /**
        //  * Show the countdown screen
        //  */
        // gameCountdown: function() {
        //   // Prepare the game screen with new HTML
        //   App.$gameArea.html(App.$templateHostGame);
        //   // App.doTextFit("#hostWord");
        //
        //   // Begin the on-screen countdown timer
        //   var $secondsLeft = $("#hostWord");
        //   App.countDown($secondsLeft, 5, function() {
        //     IO.socket.emit("hostCountdownFinished", App.gameId);
        //   });
        //
        //   // Display the players' names on screen
        //   $("#player1Score")
        //     .find(".playerName")
        //     .html(App.Host.connectedPlayers[0].playerName);
        //
        //   $("#player2Score")
        //     .find(".playerName")
        //     .html(App.Host.connectedPlayers[1].playerName);
        //
        //   // Set the Score section on screen to 0 for each player.
        //   $("#player1Score")
        //     .find(".score")
        //     .attr("id", App.Host.connectedPlayers[0].mySocketId);
        //   $("#player2Score")
        //     .find(".score")
        //     .attr("id", App.Host.connectedPlayers[1].mySocketId);
        // },

        // /**
        //  * Show the word for the current round on screen.
        //  * @param data {{round: *, word: *, answer: *, list: Array}}
        //  */
        // newWord: function(data) {
        //   // Insert the new word into the DOM
        //   $("#hostWord").text(data.word);
        //   // App.doTextFit("#hostWord");
        //
        //   // Update the data for the current round
        //   App.Host.currentCorrectAnswer = data.answer;
        //   App.Host.currentRound = data.round;
        // },
        //
        // /**
        //  * Check the answer clicked by a player.
        //  * @param data {{round: *, playerId: *, answer: *, gameId: *}}
        //  */
        // checkAnswer: function(data) {
        //   // Verify that the answer clicked is from the current round.
        //   // This prevents a 'late entry' from a player whos screen has not
        //   // yet updated to the current round.
        //   if (data.round === App.currentRound) {
        //     // Get the player's score
        //     var $pScore = $("#" + data.playerId);
        //
        //     // Advance player's score if it is correct
        //     if (App.Host.currentCorrectAnswer === data.answer) {
        //       // Add 5 to the player's score
        //       $pScore.text(+$pScore.text() + 5);
        //
        //       // Advance the round
        //       App.currentRound += 1;
        //
        //       // Prepare data to send to the server
        //       var nextData = {
        //         gameId: App.gameId,
        //         round: App.currentRound
        //       };
        //
        //       // Notify the server to start the next round.
        //       IO.socket.emit("hostNextRound", nextData);
        //     } else {
        //       // A wrong answer was submitted, so decrement the player's score.
        //       $pScore.text(+$pScore.text() - 3);
        //     }
        //   }
        // },
        //
        // /**
        //  * All 10 rounds have played out. End the game.
        //  * @param data
        //  */
        // endGame: function(data) {
        //   // Get the data for player 1 from the host screen
        //   var $p1 = $("#player1Score");
        //   var p1Score = +$p1.find(".score").text();
        //   var p1Name = $p1.find(".playerName").text();
        //
        //   // Get the data for player 2 from the host screen
        //   var $p2 = $("#player2Score");
        //   var p2Score = +$p2.find(".score").text();
        //   var p2Name = $p2.find(".playerName").text();
        //
        //   // Find the winner based on the scores
        //   var winner = p1Score < p2Score ? p2Name : p1Name;
        //   var tie = p1Score === p2Score;
        //
        //   // Display the winner (or tie game message)
        //   if (tie) {
        //     $("#hostWord").text("It's a Tie!");
        //   } else {
        //     $("#hostWord").text(winner + " Wins!!");
        //   }
        //   // App.doTextFit("#hostWord");
        //   data.winner = winner;
        //   if (data.done > 0) {
        //     // do nothing?
        //   } else data.done = 0;
        //   //console.log(data);
        //   //IO.socket.emit("clientEndGame",data);
        //   // Reset game data
        //   App.Host.numPlayersInRoom = 0;
        //   App.isNewGame = true;
        //   IO.socket.emit("hostNextRound", data);
        //   // Reset game data
        // },
        //
        // /**
        //  * A player hit the 'Start Again' button after the end of a game.
        //  */
        // restartGame: function() {
        //   App.$gameArea.html(App.$templateNewGame);
        //   $("#spanNewGameCode").text(App.gameId);
        // }
      },

      /* *******************************
       *         PLAYER CODE           *
       ******************************* */

      Player: {

        // Click handler for the 'JOIN' button:
        onJoinAGameClick: function() {
          // console.log('Clicked "Join A Game"');

          // Display the Join Game HTML on the player's screen.
          App.$gameArea.html(App.$templateJoinGame);
          App.bindEventsJoinGame();
        },

        onInputKeydown: function(e) {
          // console.log('keydown in input happened!');
          if ((e.keyCode === 13)) {
            // = "ENTER"
            // App.Player.onPlayerJoinClick();
            // e.preventDefault();
            $('#btnJoin').click();
          }
        },

        onLanguageClick: function() {
          // console.log('clicked on language');
          if (App.iAmTheGameMaster) {
            App.changeLanguage();
          }
        },

        /**
         * The player entered their name and gameId (hopefully)
         * and clicked 'play'.
         */
        onPlayerJoinClick: function() {
          // console.log('Player clicked "play"');

          // collect data to send to the server
          let data = {
            gameId: $("#inputGameId").val().toUpperCase(),
            playerName: $("#inputPlayerName").val() || "Anonymusbob"
          };

          // Send the gameId and playerName to the server
          IO.socket.emit("playerJoinsRoom", data);

          // Set the appropriate properties for the current player.
          App.myRole = "Player";
          App.myName = data.playerName;
        },

        // Click handler for the clicking a color/player piece:
        onPlayerColorClick: function(e) {
          // console.log('e.target: ', e.target);
          if ($(e.target).hasClass("selectedPlayerPiece")) {
            console.log("clicked element is already taken!");
          }
          // if you haven't yet selected a piece and it's not taken by another player:
          if (!App.selectedPieceId && !$(e.target).hasClass("selectedPlayerPiece")) {
            let pieceId = $(e.target).attr("id");

            App.Player.selectedPiece(pieceId);
            // console.log('pieceId', pieceId);
          }
        },

        selectedPiece: function(pieceId) {
          // console.log('myName: ', App.myName);
          if (App.myName && pieceId) {
            App.selectedPieceId = pieceId;
            sessionStorage.setItem("selectedPieceId", pieceId);
            $('#welcomeInstruction').addClass('hidden');

            // TODO: what happens, if two players pick the same piece at
            // the same time? check in the server before claiming the piece
            IO.socket.emit("selected piece", {
              gameId: App.gameId,
              socketId: App.mySocketId,
              selectedPieceId: pieceId,
              playerName: App.myName
            });
          }
        },

        onStartGameClick: function() {
          // e.preventDefault();
          if (App.gameStarted) {
            setTimeout(() => {
              window.alert("game has already started, please try again later");
            }, 200);
          } else if (!App.selectedPieceId) {
            let msg = "please pick a color before you start the game.";
            window.alert(msg);
            // TODO: something prettier instead of the alert
          } else if (App.players.length < 3) {
            let msg =
              "minimum number of players is 3. \nwait for more players to join the game";
            window.alert(msg);
            // TODO: something prettier instead of the alert
          } else {
            App.startGame();
          }
        },

        // /**
        //  *  Click handler for the Player hitting a word in the word list.
        //  */
        // onPlayerAnswerClick: function() {
        //   // console.log('Clicked Answer Button');
        //   var $btn = $(this); // the tapped button
        //   var answer = $btn.val(); // The tapped word
        //
        //   // Send the player info and tapped word to the server so
        //   // the host can check the answer.
        //   var data = {
        //     gameId: App.gameId,
        //     playerId: App.mySocketId,
        //     answer: answer,
        //     round: App.currentRound
        //   };
        //   IO.socket.emit("playerAnswer", data);
        // },

        // /**
        //  *  Click handler for the "Start Again" button that appears
        //  *  when a game is over.
        //  */
        // onPlayerRestart: function() {
        //   var data = {
        //     gameId: App.gameId,
        //     playerName: App.myName
        //   };
        //   IO.socket.emit("playerRestart", data);
        //   App.currentRound = 0;
        //   $("#gameArea").html("<h3>Waiting on host to start new game.</h3>");
        // },

        /**
         * Display the start menu or update it, when new player joins:
         * @param data
         */
        updateWaitingScreen: function(data) {
          if (IO.socket.id === data.mySocketId) {
            // if it was me who just joined the game room
            App.hostSocketId = data.mySocketId;
            App.myRole = "Player";
            App.gameId = data.gameId;

            App.Player.displayStartMenu(data);
            IO.socket.emit("welcome me", App.gameId);
          }
        },

        // Show the player start menu screen:
        displayStartMenu: function(data) {
          // Fill the game screen with the appropriate HTML
          App.$gameArea.html(App.$templatePlayerStartMenu);
          // cache elements & bind events for start menu:
          App.cacheElementsStartMenu();
          App.bindEventsStartMenu();
          App.preloadObjectImages();

          App.shuffleTickerObjects(App.tickerObjects);
          // move objects ticker:
          App.tickerOffsetLeft = (App.tickerObjects.offsetLeft * 100) / App.viewportWidth;
          // => number (in px), x-position of element relative to its parent
          App.moveTickerObjects();
        },

        //
        // /**
        //  * Show the "Game Over" screen.
        //  */
        // endGame: function() {
        //   $("#gameArea")
        //     .html('<div class="gameOver">Game Over!</div>')
        //     .append(
        //       // Create a button to start a new game.
        //       $("<button>Start Again</button>")
        //         .attr("id", "btnPlayerRestart")
        //         .addClass("btn")
        //         .addClass("btnGameOver")
        //     );
        // }
      },

      /* *****************************
       *     UTILITY/GENERAL CODE    *
       ***************************** */

      onWindowResize: function() {
        App.viewportWidth = window.innerWidth;
        if (App.gameStarted) {
          [App.borderTop, App.borderBottom, App.borderLeft, App.borderRight] = App.get$objBorders(
            App.$constructionArea
          );
          // TODO:
          // adjustObjectPositions(viewportWidth);
        }
        // TODO: might wanna use "debounce" to limit resizing events:
        // https://stackoverflow.com/questions/9828831/jquery-on-window-resize
        // http://underscorejs.org/#debounce
      },

      get$objBorders: function($obj) {
        let top = $obj.offset().top;
        let bottom = top + $obj.height();
        let left = $obj.offset().left;
        let right = left + $obj.width();
        return [top, bottom, left, right];
      },

      preloadObjectImages: function() {
        const objectsArray = Array.from(App.objectList);
        objectsArray.forEach(object => {
          if (!$(object).hasClass("only1")) {
            // console.log('more than one image!');
            const img = object.querySelector("img");
            // console.log(img.id);
            // console.log(img.src);
            const srcNameV = img.src.split(".png")[0];
            const newSrcBase = srcNameV.substring(0, srcNameV.length - 1);
            // console.log('active image version: ', srcNameV[srcNameV.length - 1]);
            if ($(object).hasClass("more2")) {
              let imgSrc2 = newSrcBase + 2 + ".png";
              let newImageV2 = new Image();
              newImageV2.src = imgSrc2;
            } else if ($(object).hasClass("more3")) {
              let imgSrc2 = newSrcBase + 2 + ".png";
              let imgSrc3 = newSrcBase + 3 + ".png";
              let newImageV2 = new Image();
              newImageV2.src = imgSrc2;
              let newImageV3 = new Image();
              newImageV3.src = imgSrc3;
            }
          }
        });
      },

      shuffleTickerObjects: function(ticker) {
        // based on Fisher–Yates shuffle - By Alexey Lebedev:
        for (let i = ticker.children.length; i >= 0; i--) {
          ticker.appendChild(ticker.children[(Math.random() * i) | 0]);
        }
      },

      moveTickerObjects: function() {
        App.tickerOffsetLeft = App.tickerOffsetLeft - 0.07; // moving in vw units
        // console.log('App.tickerOffsetLeft:', App.tickerOffsetLeft);
        let vwPositionOfFirstObject = (App.objectList[0].offsetWidth * 100) / App.viewportWidth;
        if (App.tickerOffsetLeft < -vwPositionOfFirstObject) {
          // true when first object is off screen..
          // add to tickerOffsetLeft the width of the currently first object
          let widthOfFirstObject = vwPositionOfFirstObject; //use clientWidth instead?
          // console.log(widthOfFirstObject);
          App.tickerOffsetLeft += widthOfFirstObject;
          // make first object the last object:
          App.tickerObjects.appendChild(App.objectList[0]); //appending will actually remove it from the start and add it to the end
        }
        App.myReq = requestAnimationFrame(App.moveTickerObjects); //like setTimeout, but the waiting time is adjusted to the framerate of used hardware(?)
        App.tickerObjects.style.left = App.tickerOffsetLeft + "vw";
      },

      changeLanguage: function() {
        // I'm the game master and I'm changing the word card language
        let newLanguage;
        if (App.chosenLanguage == "english") {
          newLanguage = "german";
        } else {
          newLanguage = "english";
        }

        IO.socket.emit("change language", {
          gameId: App.gameId,
          newLanguage: newLanguage
        });
      },

      languageHasBeenChanged: function(newLanguage) {
        // game master changed the word card language.
        App.chosenLanguage = newLanguage;
        if (newLanguage == "english") {
          $("#english-flag").removeClass("hidden");
        } else if (newLanguage == "german") {
          $("#english-flag").addClass("hidden");
        }
      },

      adjustNameFontSize: function($piece, name) {
        // to adjust font-sizes for player names:
        if (name.length <= 4) {
          $piece.addClass("name4");
        } else if (name.length <= 6) {
          $piece.addClass("name6");
        } else if (name.length <= 8) {
          $piece.addClass("name8");
        } else if (name.length <= 10) {
          $piece.addClass("name10");
        } else if (name.length <= 12) {
          $piece.addClass("name12");
        }
      },

      startGame: function() {
        // Fill the game screen with the appropriate HTML
        App.$gameArea.html(App.$templateMainGame);
        App.cacheElementsMainGame();
        // to start the game with the first 10 ticker objects that are visible when clicking playButton:
        cancelAnimationFrame(App.myReq); //stops moving ticker
        let objArray = Array.from(App.objectList);

        let activeObjects = objArray.slice(0, 10);
        let queuedObjects = objArray.slice(10);
        queuedObjects.reverse();
        App.$objects.append(activeObjects);
        App.$queue.append(queuedObjects);

        let activeObjectsHTML = $("#objects")[0].innerHTML;
        let queuedObjectsHTML = $("#queue")[0].innerHTML;

        IO.socket.emit("game started", {
          // startPlayer: selectedPieceId,
          gameId: App.gameId,
          activeObjects: activeObjectsHTML,
          queuedObjects: queuedObjectsHTML
        });

        App.setObjectPositionsAbsolute();
      },

      setObjectPositionsAbsolute: function() {
        App.$objects.children(".img-box").each(function() {
          // position() gives position relative to positioned parent
          let objTop = $(this).position().top;
          let objLeft = $(this).position().left;
          // console.log('objTop: ', objTop, 'objLeft: ', objLeft);
          $(this).css({
            top: objTop + "px",
            left: objLeft + "px"
          });
        });

        App.$objects.children(".img-box").css({
          position: "absolute"
        });
      },

      /**
      * Display the countdown timer on the Host screen
      *
      * @param $el The container element for the countdown timer
      * @param startTime
      * @param callback The function to call when the timer ends.
      */
      countDown: function($el, startTime, callback) {
        // Display the starting time on the screen.
        $el.text(startTime);
        // App.doTextFit("#hostWord");

        // console.log('Starting Countdown...');

        // Start a 1 second timer
        var timer = setInterval(countItDown, 1000);

        // Decrement the displayed timer value on each 'tick'
        function countItDown() {
          startTime -= 1;
          $el.text(startTime);
          // App.doTextFit("#hostWord");

          if (startTime <= 0) {
            // console.log('Countdown Finished.');

            // Stop the timer and do the callback.
            clearInterval(timer);
            callback();
            return;
          }
        }
      },

      /**
       * Make the text inside the given element as big as possible
       * See: https://github.com/STRML/textFit
       *
       * @param el The parent element of some text
       */
      // doTextFit: function(el) {
      //   textFit($(el)[0], {
      //     alignHoriz: true,
      //     alignVert: false,
      //     widthOnly: true,
      //     reProcess: true,
      //     maxFontSize: 300
      //   });
      // }
    };

    IO.init();
    App.init();
  })($)
);
