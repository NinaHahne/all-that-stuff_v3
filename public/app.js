jQuery(
  (function($) {
    // "use strict";

    // FIXME:
    // import axios from "axios";
    // Uncaught SyntaxError: Cannot use import statement outside a module

    /**
     * All the code relevant to Socket.IO is collected in the IO namespace.
     *
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
        IO.socket.on("disconnect", IO.onDisconnect);

        IO.socket.on("newGameCreated", IO.onNewGameCreated);
        // IO.socket.on("beginNewGame", IO.onBeginNewGame);
        IO.socket.on("playerJoinedRoom", IO.onPlayerJoinedRoom);
        IO.socket.on("errorMessage", IO.errorMessage);

        IO.socket.on("welcome", IO.onWelcome);
        IO.socket.on("add player", IO.onAddPlayer);
        IO.socket.on("add player midgame", IO.onAddPlayerMidGame);
        IO.socket.on("remove player", IO.onRemovePlayer);

        IO.socket.on("new game master", IO.onNewGameMaster);
        IO.socket.on("language has been changed", App.languageHasBeenChanged);

        IO.socket.on("game has been started", IO.onGameHasBeenStarted);
        IO.socket.on("next card", IO.onNextCard);

        IO.socket.on("objects are moving", IO.onObjectsAreMoving);
        IO.socket.on("object dropped", IO.onObjectIsDropped);
        IO.socket.on("object image changed", IO.onObjectImageChanged);
        IO.socket.on("building is done", IO.onBuildingIsDone);

        IO.socket.on("someone guessed", IO.onSomeoneGuessed);
        IO.socket.on("everyone guessed", IO.onEveryoneGuessed);
        IO.socket.on("next turn", IO.onChangeTurn);
        IO.socket.on("game ends", IO.onGameEnds);

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

        let myGameId = sessionStorage.getItem("myGameId");
        let myPlayerName = sessionStorage.getItem("myPlayerName");
        let mySelectedPieceId = sessionStorage.getItem("mySelectedPieceId");
        let myTotalPoints = parseInt(
          sessionStorage.getItem("myTotalPoints"),
          10
        );

        // if I already joined a game previously, but got disconnected:
        if (myGameId && myPlayerName && mySelectedPieceId) {
          // e.g. if a joined player disconnected unintentionally and reconnects mid game..
          IO.socket.emit("let me rejoin the game", {
            gameId: myGameId,
            selectedPieceId: mySelectedPieceId,
            playerName: myPlayerName,
            myTotalPoints: myTotalPoints
          });
        }
        // TODO: if I was the host of a game before I got disconnected:
        // get data for host screen..
      },

      onDisconnect: function() {
        console.log("disconnected");
        setTimeout(() => {
          window.alert(`
⛔ You got disconnected!
🔃 Please refresh the page to rejoin the game :)`
          );
        }, 300);
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

          setTimeout(() => {
            window.alert("game has already started, please try again later");
          }, 200);
        }

        App.gameMaster = data.gameMaster;

        App.players = data.selectedPieces;
        App.playerNames = data.playerNames;

        // console.log('players in onWelcome(): ', App.players);
        let players = App.players;
        for (let i = 0; i < players.length; i++) {
          let $piece = $("#start-menu").find("#" + players[i]);
          let $playerName = $piece.find(".player-name");
          $playerName.text(App.playerNames[players[i]]);
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
          $playerName.text(data.playerName);
          App.adjustNameFontSize($piece, data.playerName);
          // App.doTextFit(".player-name");

          // if it was me, selecting a piece:
          if (data.socketId == App.mySocketId) {
            App.selectedPieceId = data.selectedPieceId;
            sessionStorage.setItem("mySelectedPieceId", data.selectedPieceId);
            // hide "please pick a piece" message:
            $("#welcomeInstruction").addClass("hidden");

            $piece.addClass("myPiece");

            // if I'm the game master:
            if (
              data.gameMaster == App.selectedPieceId &&
              !App.iAmTheGameMaster
            ) {
              App.iAmTheGameMaster = true;
              console.log("you are the game master");
              $("#chosen-language").addClass("game-master");
              $("#chosen-language")
                .find(".crown")
                .removeClass("hidden");

              let $buttonBox = $("#start-right").find(".buttonBox");
              // let $waitingMsg = $("#logo-box").find(".waiting-msg");
              $buttonBox.removeClass("hidden");
              // $waitingMsg.addClass("hidden");
            }
          }
        }
      },

      onAddPlayerMidGame: function(data) {
        // one player got disconnected and needs to be reintegrated in the game.
        let mySelectedPieceId = sessionStorage.getItem("mySelectedPieceId");

        // if I am the rejoining player:
        if (data.selectedPieceId == mySelectedPieceId) {
          sessionStorage.setItem("mySocketId", data.socketId);
          App.mySocketId = data.socketId;
          App.myRole = "Player";
          console.log("Welcome back to the game!");

          App.selectedPieceId = mySelectedPieceId;
          App.gameId = sessionStorage.getItem("myGameId");
          App.myName = sessionStorage.getItem("myPlayerName");
          App.gameStarted = true;

          if (data.guessedAnswers[App.selectedPieceId]) {
            App.myGuess = data.guessedAnswers[App.selectedPieceId];
          }

          // Fill the game screen with the appropriate HTML
          App.$gameArea.html(App.$templateMainGame);

          App.cacheElementsMainGame();
          App.bindEventsMainGame();
          App.$doc.on("keydown", App.Player.onKeyDown);

          // Prevent image dragging in Firefox:
          App.setupMutationObserver();
          App.preventImgDragging();

          App.$joinedPlayersContainer.html(data.joinedPlayersHTML);

          App.players = data.selectedPieces;
          App.playerNames = data.playerNames;
          App.gameMaster = data.gameMaster;

          App.activePlayer = data.activePlayer;
          App.doneBtnPressed = data.doneBtnPressed;
          App.correctAnswer = data.correctAnswer;
          App.everyoneGuessed = data.everyoneGuessed;

          // display the crown for the game master:
          let players = App.players;
          // for (let i = 0; i < players.length; i++) {
          //   let $piece = $("#joined-players").find("#" + players[i]);
          //   let $crown = $piece.find(".crown");
          //   $crown.addClass("hidden");
          //   if (players[i] == App.gameMaster) {
          //     $crown.removeClass("hidden");
          //   }
          // }
          for (let i = 0; i < players.length; i++) {
            let $piece = $("#joined-players").find("#" + players[i]);
            let $playerName = $piece.find(".player-name");
            let $crown = $piece.find(".crown");

            $playerName.text(App.playerNames[players[i]]);
            $piece.addClass("selectedPlayerPiece");
            $piece.removeClass("myTurn");
            App.adjustNameFontSize($piece, $playerName[0].innerText);
            $crown.addClass("hidden");

            if (players[i] == App.gameMaster) {
              $crown.removeClass("hidden");
            }
          }

          App.numberOfTurns = data.numberOfTurnsForThisGame;
          let currentTurn = App.numberOfTurns - data.numberOfTurnsLeft + 1;
          App.$rounds.text(`${currentTurn}/${App.numberOfTurns}`);

          App.$message.removeClass("hidden");

          // first word card:
          App.cardTitle[0].innerHTML = data.firstCard.title;
          let cardItems = data.firstCard.items;
          for (let i = 0; i < cardItems.length; i++) {
            App.items[i].innerHTML = cardItems[i];
          }

          // create "points if correct" boxes:
          App.resetPointsIfCorrect();

          $(`#${data.activePlayer}`).addClass("myTurn");
          $("#construction-area").addClass(data.activePlayer);

          $("#joined-players")
            .find(".player")
            .removeClass("myPiece");
          let $myPiece = $("#joined-players").find("#" + App.selectedPieceId);
          $myPiece.addClass("myPiece");

          $(".player-points").removeClass("hidden");
          // get player points:
          App.addPoints(data);

          App.$objects[0].innerHTML = data.activeObjects;
          App.$queue[0].innerHTML = data.queuedObjects;

          // adjust object positions to my viewportWidth:
          App.adjustObjectPositions(window.innerWidth);
          // adjust selected object positions to exactly match what the builder built so far:
          App.adjustSelectedObjectPositions(
            data.activeObjects,
            data.buildersViewportWidth
          );

          // FIXME: these adjustment steps worked in AllThatStuff_v2.
          // here they don't.
          // objects do adjust correctly after resizing the window though:
          // ... but only manually. trigger window resize event doesn't work:
          // App.onWindowResize();

          setTimeout(() => {
            App.onWindowResize();
          }, 200);
          // hurray this does the trick!
          // FIXME: I should probably check, why there is asynch behaviour

          // $("#start-menu").addClass("hidden");
          $("#main-game").removeClass("hidden");

          if (data.activePlayer != App.selectedPieceId) {
            // if it's not my turn:
            App.itsMyTurn = false;

            App.$message.removeClass("bold");
            App.$message.removeClass("hidden");
            App.$message.text("...under construction...");
            App.$message.removeClass("no-animation");

            $("#done-btn").addClass("hidden");

            if (App.doneBtnPressed) {
              App.$message.addClass("bold");
              App.$message.text(`what's all that stuff?`);
              App.$message.addClass("no-animation");
            }

            if (App.everyoneGuessed) {
              App.$message.removeClass("no-animation");
              App.$message.addClass("bold");
              App.$message.text("discussion time!");
            }
          } else if (data.activePlayer == App.selectedPieceId) {
            // if it is my turn:
            App.itsMyTurn = true;

            console.log(`you drew card number ${data.firstCard.id}.`);
            console.log(`please build item number ${data.correctAnswer}`);
            $(`.highlight[key=${data.correctAnswer}]`).addClass(
              App.selectedPieceId
            );
            $("#done-btn").removeClass("hidden");
            let skippedACard = sessionStorage.getItem("skippedACard");
            console.log('skippedACard:', skippedACard);
            if (skippedACard) {
              console.log('hiding skip icon');
              $("#skip-icon").addClass("hidden");
            } else {
              console.log('displaying skip icon');
              $("#skip-icon").removeClass("hidden");
            }

            App.$message.addClass("bold");
            App.$message.text(`it's your turn!`);

            if (App.doneBtnPressed) {
              App.$message.removeClass("bold");
              App.$message.text(`done!`);
              App.$message.addClass("no-animation");
            }

            if (App.everyoneGuessed) {
              App.$message.removeClass("no-animation");
              App.$message.addClass("bold");
              App.$message.text("discussion time!");
              $("#done-btn").addClass("hidden");
            }
          }

          if (App.doneBtnPressed || App.everyoneGuessed) {
            App.dataForNextTurn = data.dataForNextTurn;
            // render guesses and correct answer with "guesses backup":
            $("#card-points")[0].innerHTML = data.cardPointsHTML;

            if (!App.itsMyTurn) {
              $(".highlight").removeClass(
                "grey purple blue green yellow orange red pink"
              );
              if (App.everyoneGuessed) {
                // display the correct answer:
                $(`.highlight[key=${data.correctAnswer}]`).addClass(
                  App.activePlayer
                );
              } else {
                // don't show the correct answer highlighted:
                // $(`.highlight[key=${App.correctAnswer}]`).removeClass(
                //   "grey purple blue green yellow orange red pink"
                // );
              }
            }
          }
        } else {
          // if I'm not the rejoining player:
          console.log(`${data.playerName} rejoined the game`);
          App.players.push(data.selectedPieceId);
        }

        let $piece = $("#joined-players").find("#" + data.selectedPieceId);
        $piece.addClass("selectedPlayerPiece");

        let $playerName = $piece.find(".player-name");
        $playerName.text(data.playerName);

        App.adjustNameFontSize($piece, data.playerName);
      },

      onRemovePlayer: function(pieceId) {
        let $piece = $("#" + pieceId);
        // console.log('$piece: ', $piece);

        if (!App.gameOver) {
          $piece.removeClass("selectedPlayerPiece");
          // this will change the font color (to white) and border style (to dashed) of the player who left.

          // if the game has not started yet (still in the start menu), also reset the player name to "?".
          if (!App.gameStarted) {
            let $playerName = $piece.find(".player-name");
            $playerName.text("?");
            $piece.removeClass("name4 name6 name8 name10 name12");
          }
        }

        // in case he was the game master and the last remaining player, delete crown for the host player screen:
        let $crown = $piece.find(".crown");
        $crown.addClass("hidden");

        App.players = App.players.filter(item => item !== pieceId);
      },

      onNewGameMaster: function(data) {
        App.gameMaster = data.newGameMaster;
        $(`#${data.oldGameMaster}`)
          .find(".crown")
          .addClass("hidden");
        if (data.newGameMaster) {
          $(`#${data.newGameMaster}`)
            .find(".crown")
            .removeClass("hidden");
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
            $("#chosen-language")
              .find(".crown")
              .removeClass("hidden");
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
        console.log(data.message);
        // only if player joined (& in case of a second game, if player pressed "play again"):
        if ((App.selectedPieceId || App.myRole == "Host") && !App.gameStarted) {
          // if I did not start the game:
          if (!App.iAmTheGameMaster) {
            cancelAnimationFrame(App.myReq);
            // display main game screen:
            App.$gameArea.html(App.$templateMainGame);
            App.cacheElementsMainGame();
            App.bindEventsMainGame();
            // Prevent image dragging in Firefox:
            App.setupMutationObserver();
            App.preventImgDragging();

            if (App.myRole == "Host") {
              $('#main-game').addClass('host');
            }

            let joinedPlayersList = App.selectPlayersContainer.getElementsByClassName(
              "selectedPlayerPiece"
            );
            let playerArray = Array.from(joinedPlayersList);
            App.$joinedPlayersContainer.append(playerArray);

            // get objects from the one who started the game (game master):
            App.$objects[0].innerHTML = data.activeObjects;
            App.$queue[0].innerHTML = data.queuedObjects;
            App.setObjectPositionsAbsolute();
          }

          App.doneBtnPressed = false;
          App.everyoneGuessed = false;

          // $("#start-menu").addClass("hidden");
          $("#main-game").removeClass("hidden");

          $(`#${data.startPlayer}`).addClass("myTurn");
          $("#construction-area").addClass(data.startPlayer);

          App.$message.removeClass("hidden");

          App.numberOfTurns = data.numberOfTurnsLeft;
          let currentTurn = App.numberOfTurns - data.numberOfTurnsLeft + 1;
          App.$rounds.text(`${currentTurn}/${App.numberOfTurns}`);

          App.$joinedPlayersContainer
            .find(".player-points")
            .removeClass("hidden");
          App.$joinedPlayersContainer.find(".player-points").each(function() {
            $(this).text("0");
          });

          //game starts with a random start player:
          App.activePlayer = data.startPlayer;

          if (data.startPlayer != App.selectedPieceId) {
            App.itsMyTurn = false;

            App.$message.removeClass("bold");
            App.$message.removeClass("no-animation");
            App.$message.text("...under construction...");

            $("#done-btn").addClass("hidden");

          } else if (data.startPlayer == App.selectedPieceId) {
            App.itsMyTurn = true;

            console.log(`you drew card number ${data.firstCard.id}.`);
            console.log(`please build item number ${data.correctAnswer}`);
            $(`.highlight[key=${data.correctAnswer}]`).addClass(
              App.selectedPieceId
            );

            App.$message.addClass("bold");
            App.$message.text(`it's your turn!`);

            $("#skip-icon").removeClass("hidden");
            $("#done-btn").removeClass("hidden");

            // remember if player skipped a card
            // in case they disconnect/reconnect:
            // sessionStorage.setItem("skippedACard", false);
            sessionStorage.removeItem("skippedACard");
          }

          // first word card:
          App.cardTitle[0].innerHTML = data.firstCard.title;
          let cardItems = data.firstCard.items;
          for (let i = 0; i < cardItems.length; i++) {
            App.items[i].innerHTML = cardItems[i];
          }

          // reset from previous game:
          App.myTotalPoints = 0;
          sessionStorage.setItem("myTotalPoints", 0);

          // create "points if correct" boxes:
          App.resetPointsIfCorrect();
          App.backupGuesses();

          App.correctAnswer = data.correctAnswer;

          if (!App.muted) {
            App.startGong.play();
          }

          App.gameStarted = true;
          App.gameOver = false;
        }
      },

      onNextCard: function(data) {
        console.log('builder skipped a card');
        App.correctAnswer = data.correctAnswer;

        // display new word card:
        App.cardTitle[0].innerHTML = data.newCard.title;
        let cardItems = data.newCard.items;
        for (let i = 0; i < cardItems.length; i++) {
          App.items[i].innerHTML = cardItems[i];
        }

        if (App.itsMyTurn) {
          console.log(`you drew card number ${data.newCard.id}.`);
          console.log(`please build item number ${data.correctAnswer}`);
          $(`.highlight[key=${data.correctAnswer}]`).addClass(
            App.selectedPieceId
          );
        }

        if (!App.muted) {
          // play a card skipping sound:
          App.paperCrumple.play();
        }

        // backup new word cards (including "empty guesses"):
        App.backupGuesses();
      },

      onObjectsAreMoving: function(data) {
        // other player moves an object.
        if (!App.itsMyTurn) {
          // $objects[0].innerHTML = data.activeObjects;
          let $movedObject = $("#objects").find(
            `.img-box.${data.clickedImgId}`
          );

          // move or rotate object:
          $movedObject.css({
            transform: `translate(${data.moveXvw}vw, ${data.moveYvw}vw) rotate(${data.transformRotate}deg)`
          });

          // bring recently moved objects to the front:
          App.pullToFront($movedObject);
        }
      },

      onObjectIsDropped: function(data) {
        // other player drops object.
        if (!App.itsMyTurn) {
          let $droppedObject = $("#objects").find(
            `.img-box.${data.clickedImgId}`
          );

          if (data.selected) {
            // bring recently dropped objects to the front:
            App.pullToFront($droppedObject);
            $droppedObject.addClass("selected");
          } else {
            // reset object position:
            $droppedObject.removeClass("selected");
            $droppedObject.css({
              transform: `translate(${0}px, ${0}px)`,
              "z-index": 1
            });
          }
        }
      },

      onObjectImageChanged: function(data) {
        if (!App.itsMyTurn) {
          const $img = $("#objects").find(`#${data.clickedImgId}`);
          // set new image source:
          $img.attr("src", data.newPicSrc);
          $(`.img-box.${data.clickedImgId}`)
            .removeClass(data.removeClass)
            .addClass(data.addClass);
        }
      },

      onBuildingIsDone: function(data) {
        // the builder finished building.
        console.log(data.message);
        if (!App.muted) {
          App.doneGong.play();
        }
        if (!App.itsMyTurn) {
          // $objects[0].innerHTML = data.activeObjects;
          App.$message.addClass("bold");
          App.$message.text(`what's all that stuff?`);

          // In case I resized my window during the building, the position of objects in the construction area could be a bit off on my screen. so to make sure, I see exactly what the builder built (at least at the moment when they click "done"), get coordinates of selected objects again:
          App.adjustSelectedObjectPositions(
            data.activeObjects,
            data.buildersViewportWidth
          );
          // TODO: maybe trigger onWindowResize() just like after rejoining?

        } else if (App.itsMyTurn) {
          App.$message.removeClass("bold");
          App.$message.text(`done!`);
        }
        App.$message.addClass("no-animation");
        App.doneBtnPressed = true;
      },

      onSomeoneGuessed: function(data) {
        // console.log("someone guessed");
        let $highestFreePointBox = $("#points-if-correct")
          .children()
          .not(".claimed")
          .first();
        // console.log('highestFreePointBox:', $highestFreePointBox);
        $highestFreePointBox.addClass(`claimed ${data.guessingPlayer}`);
        App.backupGuesses();

        if (!App.muted) {
          App.plop.play();
        }
      },

      onEveryoneGuessed: function(data) {
        console.log("everyone guessed");
        App.everyoneGuessed = true;
        setTimeout(() => {
          App.showAnswers(data);
          setTimeout(() => {
            App.showCorrectAnswer(data);
            setTimeout(() => {
              App.addPoints(data);
              setTimeout(() => {
                // show button for the game master to click, when everyone is ready for the next turn to start:
                App.dataForNextTurn = data;
                App.activePlayer = data.activePlayer;

                if (App.iAmTheGameMaster) {
                  $("#next-btn").removeClass("hidden");
                }
                if (App.itsMyTurn) {
                  $("#done-btn").addClass("hidden");
                }
                App.$message.removeClass("no-animation");
                App.$message.addClass("bold");
                App.$message.text("discussion time!");
              }, 1000); // time before change to next turn / next-button shows up
            }, 1500); // time before addPoints
          }, 1500); // time before showCorrectAnswer
        }, 500); // time before showAnswers
      },

      onChangeTurn: function(data) {
        console.log(`it's ${data.nextPlayer}'s turn now!'`);
        $(`#${data.activePlayer}`).removeClass("myTurn");
        $("#construction-area").removeClass(data.activePlayer);

        $(`#${data.nextPlayer}`).addClass("myTurn");
        $("#construction-area").addClass(data.nextPlayer);

        $(`.highlight[key=${App.correctAnswer}]`).removeClass(App.activePlayer);
        // in case someone got disconnected/reconnecetd and got the
        // backup word card in the previous turn:
        // remove all possible color classes from all word card items:
        $(`.highlight`).removeClass(
          "grey purple blue green yellow orange red pink"
        );

        // reset guess markers:
        let $guessesBoxesList = $(`.table-row`).find(".guesses");
        for (let i = 0; i < $guessesBoxesList.length; i++) {
          $guessesBoxesList[i].innerHTML = "";
        }

        // create "points if correct" boxes:
        // reset from previous game:
        App.resetPointsIfCorrect();
        App.backupGuesses();

        App.activePlayer = data.nextPlayer;
        App.correctAnswer = data.correctAnswer;
        App.myGuess = "";
        App.doneBtnPressed = false;
        App.everyoneGuessed = false;

        // objects and queue objects for the next turn were delivered by the game master. other players:
        if (!App.iAmTheGameMaster) {
          App.$objects[0].innerHTML = data.activeObjects;
          App.$queue[0].innerHTML = data.queuedObjects;

          App.setObjectPositionsAbsolute();
        }

        // new word card:
        App.cardTitle[0].innerHTML = data.newCard.title;
        let cardItems = data.newCard.items;
        for (let i = 0; i < cardItems.length; i++) {
          App.items[i].innerHTML = cardItems[i];
        }

        App.$message.removeClass("hidden");
        App.$message.removeClass("no-animation");
        $("#next-btn").addClass("hidden");

        // update number of turns left:
        let currentTurn = App.numberOfTurns - data.numberOfTurnsLeft + 1;
        App.$rounds.text(`${currentTurn}/${App.numberOfTurns}`);

        // if next turn is my turn:
        if (data.nextPlayer == App.selectedPieceId) {
          App.itsMyTurn = true;

          console.log(`you drew card number ${data.newCard.id}.`);
          console.log(`please build item number ${data.correctAnswer}`);
          $(`.highlight[key=${data.correctAnswer}]`).addClass(
            App.selectedPieceId
          );
          $("#done-btn").removeClass("hidden");
          $("#skip-icon").removeClass("hidden");

          // remember if player skipped a card
          // in case they disconnect/reconnect:
          // sessionStorage.setItem("skippedACard", false);
          sessionStorage.removeItem("skippedACard");

          App.$message.text(`it's your turn!`);
          App.$message.addClass("bold");
        } else {
          // if next turn is not my turn:
          $("#done-btn").addClass("hidden");
          App.$message.removeClass("bold");
          App.$message.text("...under construction...");
          App.itsMyTurn = false;
        }

        if (!App.muted) {
          App.startGong.play();
        }
      },

      onGameEnds: function(data) {
        if (App.gameStarted) {
          App.gameStarted = false;
          App.gameOver = true;
          // Fill the game screen with the appropriate HTML
          App.$gameArea.html(App.$templateGameEnd);
          App.bindEventsGameEnd();

          console.log(`game is over`);

          $("#main-game").addClass("hidden");
          $("#game-end").removeClass("hidden");

          let $playersEnd = $("#players-end");

          let ranking = data.rankingArray;
          // for (let i = 0; i < ranking.length; i++) {
          //   let playerElement = `<div class="player ${ranking[i].player}">
          //               <div class="player-name">${ranking[i].name}:</div>
          //               <div class="player-points">${ranking[i].points}</div>
          //           </div>`;
          //
          //   $playersEnd.append(playerElement);
          //
          //   let $piece = $("#players-end").find("." + ranking[i].player);
          //   adjustNameFontSize($piece, ranking[i].name);
          // }

          $playersEnd[0].innerHTML = data.joinedPlayersHTML;
          $playersEnd
            .find(`#${App.gameMaster}`)
            .find(".crown")
            .addClass("hidden");

          setTimeout(() => {
            App.rankingAnimations(ranking);
          }, 500);
        }
      },

      /**
       * An error has occurred.
       * @param data
       */
      errorMessage: function(data) {
        window.alert(data.message);
      }
    };

    var App = {
      // TODO: disable testing mode before deploying
      testingMode: false,
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
      gameOver: false,
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
        App.$templateGameEnd = $("#game-end-template").html();
        // App.$templateHostGame = $("#host-game-template").html();

        // SOUNDS:
        App.ringDropSound = new Audio(
          "./sounds/218823__djtiii__staple-drop.wav"
        );
        App.universalDropSound = new Audio(
          "./sounds/157539__nenadsimic__click.wav"
        );
        App.startGong = new Audio("./sounds/56240__q-k__gong-center-clear.wav");
        App.doneGong = new Audio("./sounds/434627__dr-macak__ding.wav");
        App.paperCrumple = new Audio("./sounds/508597__drooler__crumple-06.ogg");
        App.successJingle = new Audio(
          "./sounds/270404__littlerobotsoundfactory__jingle-achievement-00.wav"
        );
        App.drumroll = new Audio("./sounds/12896__harri__circus-short.mp3");
        App.bubblePop1 = new Audio(
          "./sounds/422813__pinto0lucas__bubble-low.wav"
        );
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
        // App.$doc = $(document);

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

        [
          App.borderTop,
          App.borderBottom,
          App.borderLeft,
          App.borderRight
        ] = App.get$objBorders(App.$constructionArea);
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

        // App.$doc.on("click", "#btnPlayerRestart", App.Player.onPlayerRestart);

        // Host & Players:
        $(window).on("resize", App.onWindowResize);
      },

      bindEventsStartMenu: function() {
        $("#start-menu").on("click", ".player", App.Player.onPlayerColorClick);
        $("#chosen-language").on("click", App.Player.onLanguageClick);
        App.$startGameBtn.on("click", App.Player.onStartGameClick);
        App.$doc.on("keydown", App.Player.onKeyDown);

        // touch events:
        App.touch = true;
        $(document).on("touchstart", ".img-box", e => {
          App.Player.onMouseDown(e, App.touch);
        });

        $(document).on("touchmove", e => {
          App.Player.onMouseMove(e, App.touch);
        });

        $(document).on("touchend", e => {
          App.Player.onMouseUp(e, App.touch);
        });
      },

      bindEventsJoinGame: function() {
        $("#inputGameId").on("keydown", App.Player.onInputKeydown);
        $("#inputPlayerName").on("keydown", App.Player.onInputKeydown);
      },

      bindEventsMainGame: function() {
        // mouse events:
        App.$doc.on("mousedown", ".img-box", App.Player.onMouseDown);
        App.$doc.on("mousemove", App.Player.onMouseMove);
        App.$doc.on("mouseup", App.Player.onMouseUp);
        // App.$doc.on("keydown", App.Player.onKeyDown);
        App.$doc.on("dblclick", ".img-box", App.Player.onDblClick);
        $("#card-points").on(
          "mousedown",
          ".table-row",
          App.Player.onCardMousDown
        );

        $("#done-btn").on("click", App.Player.onDoneBtnClick);
        $("#help-btn").on("click", App.Player.toggleHelp);
        $("#next-btn").on("click", App.Player.clickedReadyForNextTurn);

        // show/hide "skip this card" message on hover over skip icon:
        $('#skip-icon').hover(App.Player.showSkipMsg, App.Player.hideSkipMsg);

        $("#skip-icon").on("click", App.Player.clickedSkipCard);

        // touch events:
        $("img").on("contextmenu", e => {e.preventDefault();});
        $(".wordcard").on("contextmenu", e => {e.preventDefault();});
        $("#construction-area").on("contextmenu", e => {e.preventDefault();});

      },

      bindEventsGameEnd: function() {
        // TODO: do something else here
        $("#play-again-btn").on("click", () => window.location.reload(false));
      },

      // PREVENT IMAGE DRAGGING IN FIREFOX ********************************
      // https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
      setupMutationObserver: function() {
        // MutationObserver for everytime the objects are refilled
        // (on game start and new turns):

        // Select the node that will be observed for mutations
        App.targetNode = document.getElementById("objects");
        // Options for the observer (which mutations to observe)
        App.config = { attributes: false, childList: true, subtree: false };

        // Create an observer instance linked to the callback function
        App.observer = new MutationObserver(App.imgMutationObserver);
      },

      // Callback function to execute when mutations are observed
      imgMutationObserver: function(mutationsList, observer) {
        let newImages;
        // Use traditional 'for loops' for IE 11
        for (let mutation of mutationsList) {
          if (mutation.type === "childList") {
            // console.log('A child node has been added or removed.');
            newImages = true;
          }
          // else if (mutation.type === 'attributes') {
          //     console.log('The ' + mutation.attributeName + ' attribute was modified.');
          // }
        }
        if (newImages) {
          // collect all images on the page
          let imgs = App.targetNode.getElementsByTagName("img");
          for (let i = 0; i < imgs.length; i++) {
            // and define onmousedown event handler / disable img dragging:
            // console.log('onmousedown event handler is defined for ', imgs[i]);
            imgs[i].onmousedown = e => {
              e.preventDefault();
            };
          }
        }
      },

      preventImgDragging: function() {
        // Start observing the target node for configured mutations
        App.observer.observe(App.targetNode, App.config);
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
          App.Host.displayStartMenu();
        },

        /**
         * Show the Host start menu screen containing the game URL and game ID
         */
        displayStartMenu: function() {
          // Fill the game screen with the appropriate HTML
          App.$gameArea.html(App.$templateHostStartMenu);
          App.cacheElementsStartMenu();
          App.bindEventsStartMenu();
          App.preloadObjectImages();

          // Display the URL on screen
          // $("#gameURL").text(window.location.href);
          // Show the gameId / room id on screen
          $("#spanNewGameCode").text(App.gameId);

          App.shuffleTickerObjects(App.tickerObjects);
          // move objects ticker:
          App.tickerOffsetLeft =
            (App.tickerObjects.offsetLeft * 100) / App.viewportWidth;
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
            App.Host.displayStartMenu();
          }
          // Update host screen:
          let message = `<p>${data.playerName} joined the room.</p>`;
          $("#playersWaiting").append(message);

          // Store the new player's data on the Host.
          App.Host.connectedPlayers.push(data);

          // Increment the number of players in the room
          App.Host.numPlayersInRoom += 1;
          // TODO: currently not using this info..
        }

        // /**
        //  * A player hit the 'Start Again' button after the end of a game.
        //  */
        // TODO: restart game:
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
          // console.log('Clicked "JOIN" a game');

          // Display the Join Game HTML on the player's screen.
          App.$gameArea.html(App.$templateJoinGame);
          App.bindEventsJoinGame();
        },

        onInputKeydown: function(e) {
          // console.log('keydown in input happened!');
          if (e.keyCode === 13) {
            // = "ENTER"
            // App.Player.onPlayerJoinClick();
            // e.preventDefault();
            $("#btnJoin").click();
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

          // Set the properties for the current player.
          App.myRole = "Player";
          App.myName = data.playerName;
          sessionStorage.setItem("myPlayerName", data.playerName);
        },

        // Click handler for the clicking a color/player piece:
        onPlayerColorClick: function(e) {
          // console.log('e.target: ', e.target);
          if ($(e.target).hasClass("selectedPlayerPiece")) {
            console.log("clicked element is already taken!");
          }
          // if you haven't yet selected a piece and it's not taken by another player:
          if (
            !App.selectedPieceId &&
            !$(e.target).hasClass("selectedPlayerPiece")
          ) {
            let pieceId = $(e.target).attr("id");

            App.Player.selectedPiece(pieceId);
            // console.log('selected pieceId/color:', pieceId);
          }
        },

        selectedPiece: function(pieceId) {
          // console.log('myName: ', App.myName);
          if (App.myName && pieceId) {

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

        onMouseDown: function(e, touch) {
          if (App.gameStarted && App.itsMyTurn && !App.doneBtnPressed) {
            if (touch) {
              e.preventDefault();
              // e.preventDefault && e.preventDefault();
              // console.log('touchstart!');
            }
            // player can only skip a wordcard until they clicked an object:
            $("#skip-icon").addClass("hidden");

            App.objectClicked = true;
            // $clickedImgBox = $(this) || e.currentTarget;
            App.$clickedImgBox = $(e.currentTarget);

            // reset transform rotate:
            App.transformRotate = 0;
            // console.log($clickedImgBox);

            // show name of clicked object:
            App.$clickedImgId = App.$clickedImgBox.find("img").attr("id");
            console.log(App.$clickedImgId);
            App.$clickedImgBox.addClass("move");
            // start position if mouse event || touch event:
            App.startX = e.clientX || e.touches[0].clientX;
            App.startY = e.clientY || e.touches[0].clientY;

            // get the clicked object to the very front:
            App.pullToFront(App.$clickedImgBox);

            // to move an object, that's already in the construction area, check the transform props and calculate with them when invoking updatePosition():
            if (App.$clickedImgBox.hasClass("selected")) {
              [
                App.translateX,
                App.translateY,
                App.transformRotate
              ] = App.getTransformProps(App.$clickedImgBox);
              // set move props of clicked object to current values, in case it will be moved or rotated later:
              App.moveX = App.translateX;
              App.moveY = App.translateY;
            }
          }
        },

        onMouseMove: function(e, touch) {
          if (App.objectClicked) {
            if (touch) {
              e.preventDefault();
              // e.preventDefault && e.preventDefault();
              // console.log('touchmove!');
            }
            App.updatePosition(e);
          }
        },

        onMouseUp: function(e, touch) {
          if (App.objectClicked) {
            if (touch) {
              e.preventDefault();
              // e.preventDefault && e.preventDefault();
              // console.log('touchend!');
            }
            const $clickedImgBox = $(".move");
            // new position if mouse event || touch event:
            const posX = e.clientX || e.changedTouches[0].clientX;
            const posY = e.clientY || e.changedTouches[0].clientY;
            if (!App.muted && App.objectMoved) {
              if (App.uniSound) {
                App.universalDropSound.play();
              } else {
                const currentObj = App.objObj.find(
                  obj => obj.name === App.$clickedImgId
                );
                new Audio("./sounds/" + currentObj.sound).play();
              }
            }
            let selected;
            //only if object is dropped (when cursor is) inside the construction area:
            if (
              App.borderLeft < posX &&
              posX < App.borderRight &&
              App.borderTop < posY &&
              posY < App.borderBottom
            ) {
              $clickedImgBox.addClass("selected");
              selected = true;
              // if dropped ouside construction area, put it back to it's original position:
            } else {
              $clickedImgBox.removeClass("selected");
              selected = false;
              // reset object position:
              $clickedImgBox.css({
                transform: `translate(${0}px, ${0}px)`,
                "z-index": 1
              });
            }

            $clickedImgBox.removeClass("move");
            App.objectClicked = false;
            App.objectMoved = false;

            IO.socket.emit("dropping object", {
              gameId: App.gameId,
              activePlayer: App.activePlayer,
              clickedImgId: App.$clickedImgId,
              selected: selected
            });
          }
        },

        onKeyDown: function(e) {
          if (e.keyCode == 83) {
            // = "S"
            if (App.uniSound) {
              App.ringDropSound.play();
              App.uniSound = false;
            } else {
              App.universalDropSound.play();
              App.uniSound = true;
            }
          } else if (e.keyCode == 77) {
            // = "M"
            if (App.muted) {
              App.muted = false;
              $("#muted").addClass("hidden");
              $("#sound-on").removeClass("hidden");
              setTimeout(() => {
                $("#sound-on").addClass("hidden");
              }, 2000);
              if (App.uniSound) {
                App.universalDropSound.play();
              } else {
                App.ringDropSound.play();
              }
            } else {
              App.muted = true;
              $("#sound-on").addClass("hidden");
              $("#muted").removeClass("hidden");
            }
          } else if (e.keyCode == 13) {
            // = "ENTER"
            if (App.itsMyTurn) {
              App.Player.onDoneBtnClick();
            }
          } else if (e.keyCode == 32) {
            // = "SPACE"
            // do something..
          } else if (e.keyCode == 79) {
            // = "O"
            // forcing "game end":
            if (App.testingMode && App.iAmTheGameMaster && App.gameStarted) {
              console.log("forcing game end");
              App.endGame();
            }
          } else if (e.keyCode == 81) {
            // = "Q"
            if (App.itsMyTurn) {
              App.rotateObject("clockwise");
            }
          } else if (e.keyCode == 69) {
            // = "E"
            if (App.itsMyTurn) {
              App.rotateObject("counterclockwise");
            }
          }
        },

        onDblClick: function(e) {
          if (App.gameStarted && App.itsMyTurn && !App.doneBtnPressed) {
            let imgBox = e.currentTarget;
            App.changeObjectImage(imgBox);
          }
        },

        onCardMousDown: function(e) {
          // guess a word from the card.
          // console.log('clicked on a word');

          if (!App.itsMyTurn && !App.myGuess && App.doneBtnPressed) {
            App.myGuess = e.currentTarget.getAttribute("key");
            // console.log("you clicked on: ", App.myGuess);
            $(`.highlight[key=${App.myGuess}]`).addClass(
              `${App.selectedPieceId}`
            );
            IO.socket.emit("made a guess", {
              gameId: App.gameId,
              guessingPlayer: App.selectedPieceId,
              guessedItem: App.myGuess
            });
          }
        },

        onDoneBtnClick: function() {
          // it's my turn and I clicked the "done" button.
          const $selectedObjects = $("#objects").find(".selected");

          // check if there is at least 1 object in the construction area:
          if ($selectedObjects.length > 0) {
            let activeObjectsHTML = $("#objects")[0].innerHTML;

            // In case someone resized their window during the building, the position of objects in the construction area could be a bit off on their screen. so to make sure, they see exactly what the builder (me) built, send along my current viewportWidth:
            // console.log('viewportWidth:', viewportWidth);

            IO.socket.emit("done building", {
              gameId: App.gameId,
              activePlayer: App.activePlayer,
              activeObjects: activeObjectsHTML,
              buildersViewportWidth: App.viewportWidth
            });
          }
        },

        toggleHelp: function() {
          if (App.$instructions.hasClass("hidden")) {
            App.$instructions.removeClass("hidden");
          } else {
            App.$instructions.addClass("hidden");
          }
        },

        showSkipMsg: function(){
          if (App.itsMyTurn) {
            $('#skip-msg').removeClass('hidden');
          }
        },

        hideSkipMsg: function(){
          if (App.itsMyTurn) {
            $('#skip-msg').addClass('hidden');
          }
        },

        clickedReadyForNextTurn: function() {
          // game master decides when it's time for the next turn:
          // NOTE: this function is only triggered by the GAME MASTER when clicking "ready for next turn". other players will get the objects for next turn from the game master.
          const $selectedObjects = $("#objects").find(".selected");

          const numberOfUsedObjects = $selectedObjects.length;

          App.$objects.children(".img-box").css({
            position: "unset"
          });
          $selectedObjects.each(function() {
            // reset object images to v1:
            App.resetObjectImage($(this));

            $(this).removeClass("selected");
            $(this).css({
              position: "unset",
              transform: `translate(${0}px, ${0}px)`,
              "z-index": 1
            });
            App.$queue.prepend($(this));
          });
          for (let i = 0; i < numberOfUsedObjects; i++) {
            // used together with css flex wrap in #objects:
            // $objects.append($queue.children().last());

            // used together with css flex wrap-reverse in #objects:
            App.$objects.prepend(App.$queue.children().last());
          }

          let activeObjectsHTML = $("#objects")[0].innerHTML;
          let queuedObjectsHTML = $("#queue")[0].innerHTML;
          let joinedPlayersHTML = $("#joined-players")[0].innerHTML;

          IO.socket.emit("objects for next turn", {
            gameId: App.gameId,
            activePlayer: App.activePlayer,
            activeObjects: activeObjectsHTML,
            queuedObjects: queuedObjectsHTML,
            joinedPlayersHTML: joinedPlayersHTML
          });

          App.setObjectPositionsAbsolute();
        },

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
            sessionStorage.setItem("myGameId", data.gameId);

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
          App.tickerOffsetLeft =
            (App.tickerObjects.offsetLeft * 100) / App.viewportWidth;
          // => number (in px), x-position of element relative to its parent
          App.moveTickerObjects();
        },

        clickedSkipCard: function() {
          if (App.itsMyTurn) {
            // console.log('skip this card!');
            $(`.highlight[key=${App.correctAnswer}]`).removeClass(
              App.selectedPieceId
            );
            IO.socket.emit("skip card", App.gameId);
            // players can only skip one card per turn..
            $(this).addClass("hidden");
            // remember if player skipped a card
            // in case they disconnect/reconnect:
            sessionStorage.setItem("skippedACard", "true");
          }
        }
      },

      /* *****************************
       *     UTILITY/GENERAL CODE    *
       ***************************** */

      onWindowResize: function() {
        // console.log('onWindowResize happening');
        App.viewportWidth = window.innerWidth;
        if (App.gameStarted) {
          [
            App.borderTop,
            App.borderBottom,
            App.borderLeft,
            App.borderRight
          ] = App.get$objBorders(App.$constructionArea);

          App.adjustObjectPositions(App.viewportWidth);
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
        let vwPositionOfFirstObject =
          (App.objectList[0].offsetWidth * 100) / App.viewportWidth;
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
        // to start the game with the first 10 ticker objects that are visible when clicking playButton:
        cancelAnimationFrame(App.myReq); //stops moving ticker
        let objArray = Array.from(App.objectList);

        // save some HTML elements from the start menu for later use:
        let activeObjects = objArray.slice(0, 10);
        let queuedObjects = objArray.slice(10);
        queuedObjects.reverse();
        let joinedPlayersList = App.selectPlayersContainer.getElementsByClassName(
          "selectedPlayerPiece"
        );
        let playerArray = Array.from(joinedPlayersList);

        // Fill the game screen with the main game HTML:
        App.$gameArea.html(App.$templateMainGame);
        App.cacheElementsMainGame();
        App.bindEventsMainGame();
        // Prevent image dragging in Firefox:
        App.setupMutationObserver();
        App.preventImgDragging();

        App.$objects.append(activeObjects);
        App.$queue.append(queuedObjects);

        App.$joinedPlayersContainer.append(playerArray);

        let joinedPlayersHTML = $("#joined-players")[0].innerHTML;
        let activeObjectsHTML = $("#objects")[0].innerHTML;
        let queuedObjectsHTML = $("#queue")[0].innerHTML;

        IO.socket.emit("game started", {
          // startPlayer: selectedPieceId,
          gameId: App.gameId,
          joinedPlayersHTML: joinedPlayersHTML,
          activeObjects: activeObjectsHTML,
          queuedObjects: queuedObjectsHTML
        });

        //   TODO: create new game entry in the database:
        const gameData = {
            gameId: App.gameId,
            players: App.playerNames
        }
        // axios
        //     .post("/", gameData)
        //     .then(() => {
        //         console.log('game entry successfully created!');
        //     })
        //     .catch(err => {
        //         console.log("err in create game: ", err);
        //     });

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

      adjustObjectPositions: function(viewportWidth) {
        // console.log('adjustObjectPositions happening');
        // safe transform values of selected objects:
        let savedTransformProps = {};
        App.$objects = $('#objects');
        App.$objects.find(".selected").each(function() {
          let imgId = $(this).find("img").attr("id");

          let [translateXpx, translateYpx, rotate] = App.getTransformProps(
            $(this)
          );
          // console.log('translateXpx, translateYpx, rotate:', translateXpx, translateYpx, rotate);

          let translateXvw = (translateXpx * 100) / viewportWidth;
          let translateYvw = (translateYpx * 100) / viewportWidth;

          savedTransformProps[imgId] = [translateXvw, translateYvw, rotate];
          // console.log('savedTransformProps of', imgId, ':', savedTransformProps[imgId]);
        });

        // unset current transform props:
        App.$objects.find(".selected").css({
          transform: `translate(${0}vw, ${0}vw) rotate(${0}deg)`
        });

        // unset absolute position of objects to make them readjust to new objects container size and then go back to position absolute with setObjectPositionsAbsolute():
        App.$objects.children(".img-box").css({
          position: "unset"
        });
        App.setObjectPositionsAbsolute();

        // get saved transform props back for selected objects:
        App.$objects.find(".selected").each(function() {
          let imgId = $(this)
            .find("img")
            .attr("id");

          $(this).css({
            transform: `translate(${savedTransformProps[imgId][0]}vw, ${savedTransformProps[imgId][1]}vw) rotate(${savedTransformProps[imgId][2]}deg)`
          });
        });
      },

      adjustSelectedObjectPositions: function(
        usedObjects,
        buildersViewportWidth
      ) {
        // console.log('adjustSelectedObjectPositions happening');
        // NOTE: I can't use getTransformProps(); here because it only gets
        // the transform props of a RENDERED HTML ELEMENT.
        // but here I use an unrendered HTML element just to get the transformProps
        // from the selected objects the builder used

        let usedObjectsDiv = document.createElement("div");
        usedObjectsDiv.innerHTML = usedObjects;
        let $selectedObjects = $(usedObjectsDiv).find(".selected");
        // console.log('$selectedObjects:', $selectedObjects);

        // get transform props of all selected objects:
        $selectedObjects.each(function() {
          let imgId = $(this)
            .find("img")
            .attr("id");

          let transformProps = $(this).css("transform");
          // looks like: translate(-303px, -291px) rotate(0deg)

          let transformPropsSplit = transformProps.split(") rotate(");
          // console.log('transformPropsSplit:', transformPropsSplit);

          let rotate = transformPropsSplit[1].split("deg)")[0];

          let translateProps = transformPropsSplit[0].split("translate(")[1];
          translateProps = translateProps.split(", ");
          let translateXpx = Number(translateProps[0].split("px")[0]);
          let translateYpx = Number(translateProps[1].split("px")[0]);

          // recalculate translate props for other players using relative vw units:
          let translateXvw = (translateXpx * 100) / buildersViewportWidth;
          let translateYvw = (translateYpx * 100) / buildersViewportWidth;

          $("#objects")
            .find(`.${imgId}`)
            .css({
              transform: `translate(${translateXvw}vw, ${translateYvw}vw) rotate(${rotate}deg)`
            });
        });
      },

      getTransformProps: function($element) {
        const transformProps = $element.css("transform");
        var tValues = transformProps.split("(")[1],
          tValues = tValues.split(")")[0],
          tValues = tValues.split(",");

        // get the transform/translate properties:
        let translateX = Number(tValues[4]);
        let translateY = Number(tValues[5]);

        //  https://css-tricks.com/get-value-of-css-rotation-through-javascript/
        // get the transform/rotate properties:
        let a = Number(tValues[0]);
        let b = Number(tValues[1]);
        // let c= Number(values[2]);
        // let d= Number(values[3]);
        // console.log('a: ', a, 'b: ', b, 'c: ', c, 'd: ', d);

        let rotate = Math.round(Math.atan2(b, a) * (180 / Math.PI));

        return [translateX, translateY, rotate];
      },

      resetPointsIfCorrect: function() {
        $("#points-if-correct")[0].innerHTML = "";
        let highestAchievablePoint = App.players.length - 1;
        for (let i = highestAchievablePoint; i > 0; i--) {
          let points = i;
          if (i > 5) {
            points = 5;
          }
          let elem = `<div class="points">${points}</div>`;
          $("#points-if-correct").append(elem);
        }
      },

      pullToFront: function($imgBox) {
        let highestZIndex = 1;
        $("#objects")
          .find(".selected")
          .each(function() {
            const currentZIndex = Number($(this).css("z-index"));
            if (currentZIndex > highestZIndex) {
              highestZIndex = currentZIndex;
            }
          });
        $imgBox.css({
          "z-index": highestZIndex + 1
        });
      },

      changeObjectImage: function(imgBox) {
        // it's my turn and I'm changing an object image.

        if (!$(imgBox).hasClass("only1")) {
          // console.log('more than one image!');
          const img = imgBox.querySelector("img");
          const fileName = img.src.split("objects/")[1];
          const projectPath = "/objects/" + fileName;
          const srcNameV = projectPath.split(".png")[0];
          const newSrcBase = srcNameV.substring(0, srcNameV.length - 1);

          let newPicSrc;
          let removeClass;
          let addClass;
          if ($(imgBox).hasClass("more2")) {
            if ($(imgBox).hasClass("v1")) {
              img.src = newSrcBase + 2 + ".png";
              newPicSrc = newSrcBase + 2 + ".png";
              $(imgBox)
                .removeClass("v1")
                .addClass("v2");
              removeClass = "v1";
              addClass = "v2";
            } else if ($(imgBox).hasClass("v2")) {
              img.src = newSrcBase + 1 + ".png";
              newPicSrc = newSrcBase + 1 + ".png";
              $(imgBox)
                .removeClass("v2")
                .addClass("v1");
              removeClass = "v2";
              addClass = "v1";
            }
          } else if ($(imgBox).hasClass("more3")) {
            if ($(imgBox).hasClass("v1")) {
              img.src = newSrcBase + 2 + ".png";
              newPicSrc = newSrcBase + 2 + ".png";
              $(imgBox)
                .removeClass("v1")
                .addClass("v2");
              removeClass = "v1";
              addClass = "v2";
            } else if ($(imgBox).hasClass("v2")) {
              img.src = newSrcBase + 3 + ".png";
              newPicSrc = newSrcBase + 3 + ".png";
              $(imgBox)
                .removeClass("v2")
                .addClass("v3");
              removeClass = "v2";
              addClass = "v3";
            } else if ($(imgBox).hasClass("v3")) {
              img.src = newSrcBase + 1 + ".png";
              newPicSrc = newSrcBase + 1 + ".png";
              $(imgBox)
                .removeClass("v3")
                .addClass("v1");
              removeClass = "v3";
              addClass = "v1";
            }
          }
          // console.log("newPicSrc:", newPicSrc);
          IO.socket.emit("changed object image", {
            gameId: App.gameId,
            clickedImgId: App.$clickedImgId,
            newPicSrc: newPicSrc,
            removeClass: removeClass,
            addClass: addClass
          });
        } else {
          console.log("this object has only one image!");
        }
      },

      // drag&drop objects:
      updatePosition: function(e) {
        // it's my turn and I'm moving an object.
        App.objectMoved = true;
        const $clickedImgBox = $(".move");

        if (e.clientX) {
          // if mouse event:
          App.moveX = e.clientX - App.startX;
          App.moveY = e.clientY - App.startY;
        } else {
          // if touch event:
          App.moveX = e.changedTouches[0].clientX - App.startX;
          App.moveY = e.changedTouches[0].clientY - App.startY;
        }

        // to move an object, that's already in the construction area, check the transform props and calculate with them:
        if ($clickedImgBox.hasClass("selected")) {
          App.moveX += App.translateX;
          App.moveY += App.translateY;
        }

        $clickedImgBox.css({
          transform: `translate(${App.moveX}px, ${App.moveY}px) rotate(${App.transformRotate}deg)`
        });

        // transform px units in vw units:
        App.moveXvw = (App.moveX * 100) / App.viewportWidth;
        // console.log('moveXvw:', moveXvw);
        App.moveYvw = (App.moveY * 100) / App.viewportWidth;
        // console.log('moveYvw:', moveYvw);
        App.moveObjects(
          App.$clickedImgId,
          App.moveXvw,
          App.moveYvw,
          App.transformRotate
        );
      },

      rotateObject: function(direction) {
        // it's my turn and I'm rotating an object.
        if (App.$clickedImgBox.hasClass("selected")) {
          let rotate;
          if (direction == "clockwise") {
            rotate = 5;
          } else if (direction == "counterclockwise") {
            rotate = -5;
          }
          // console.log('$clickedImgBox while rotateObject(): ', $clickedImgBox);
          // add new rotation to excisting transform rotate property:
          App.transformRotate += rotate;

          App.$clickedImgBox.css({
            transform: `translate(${App.moveX}px, ${App.moveY}px) rotate(${App.transformRotate}deg)`
          });
          App.moveObjects(
            App.$clickedImgId,
            App.moveXvw,
            App.moveYvw,
            App.transformRotate
          );
        }
      },

      moveObjects: function(clickedImgId, moveXvw, moveYvw, transformRotate) {
        // it's my turn and I am moving an object.
        // pass objects with new coordinates to all players:
        let activeObjectsHTML = $("#objects")[0].innerHTML;

        IO.socket.emit("moving objects", {
          gameId: App.gameId,
          activePlayer: App.activePlayer,
          activeObjects: activeObjectsHTML,
          clickedImgId: clickedImgId,
          moveXvw: moveXvw,
          moveYvw: moveYvw,
          transformRotate: transformRotate,
          viewportWidth: App.viewportWidth
        });
      },

      showAnswers: function(data) {
        if (!App.itsMyTurn && App.myRole == "Player") {
          // $(`.highlight[key=${App.myGuess}]`).removeClass(App.selectedPieceId);
          // in case someone got disconnected/reconnecetd and got the
          // backup word card during the guessing phase:
          // remove all possible color classes from all word card items:
          $(".highlight").removeClass(
            "grey purple blue green yellow orange red pink"
          );
        }
        // show answers of all guessers:
        for (let player in data.guessedAnswers) {
          let $guessesBoxInCardItem = $(
            `.table-row[key=${data.guessedAnswers[player]}]`
          ).find(".guesses");

          let newGuess = `<div class="guess ${player}"></div>`;

          $guessesBoxInCardItem.append(newGuess);
          // empty guesses div for next turn.... also for startGame?
        }
        App.backupGuesses();

        if (!App.muted) {
          // pop sound for displaying all answers:
          App.plop.play();
          // drumroll until showCorrectAnswer:
          // adding 700ms..
          setTimeout(() => {
            App.drumroll.play();
          }, 700);
        }
      },

      backupGuesses: function() {
        // save status of guesses in case someone disconnects/reconnects:
        if (App.iAmTheGameMaster) {
          let cardPointsHTML = $("#card-points")[0].innerHTML;

          IO.socket.emit("guesses backup", {
            gameId: App.gameId,
            cardPointsHTML: cardPointsHTML
          });
        }
      },

      showCorrectAnswer: function(data) {
        // show correct answer:
        $(`.highlight[key=${data.correctAnswer}]`).addClass(App.activePlayer);
        App.backupGuesses();
      },

      addPoints: function(data) {
        for (let player in data.playerPointsTotal) {
          // console.log(`adding points for player ${player}`);
          let $piece = $("#" + player);
          let $playerPoints = $piece.find(".player-points");
          $playerPoints.text(data.playerPointsTotal[player]);
          App.flashPoints($playerPoints);

          if (player == App.selectedPieceId) {
            App.myTotalPoints = data.playerPointsTotal[player];
            sessionStorage.setItem(
              "myTotalPoints",
              data.playerPointsTotal[player]
            );
          }
        }

        if (!App.muted) {
          App.bubblePop1.play();
        }
      },

      flashPoints: function($playerPoints) {
        $playerPoints.css({
          transform: `scale(1.2)`
        });
        setTimeout(function() {
          $playerPoints.css({
            transform: `scale(1)`
          });
        }, 350);
      },

      resetObjectImage: function($selectedObject) {
        if (
          !$selectedObject.hasClass("v1") &&
          !$selectedObject.hasClass("only1")
        ) {
          let $img = $selectedObject.find("img");
          let oldSrc = $img.attr("src");
          let srcNameV = oldSrc.split(/2.png|3.png/g)[0];
          let newSrc = srcNameV + "1.png";

          // set new image source:
          $img.attr("src", newSrc);
          $selectedObject.removeClass("v2 v3").addClass("v1");
        }
      },

      endGame: function() {
        IO.socket.emit("end game", App.gameId);
      },

      rankingAnimations: function(rankingArr) {
        let $playersEnd = $("#players-end");
        let maxScore = rankingArr[0].points;
        // console.log('highest score:', maxScore);
        let lowestScore = rankingArr[rankingArr.length - 1].points;
        // console.log('lowest score:', lowestScore);

        // 38 vw maximum drop height:
        let maxFallHeight = "38";

        for (let i = 0; i < rankingArr.length; i++) {
          let $playerPiece = $playersEnd.find(`#${rankingArr[i].player}`);
          let score = rankingArr[i].points;
          // let fallHeight = (1 - score/maxScore) * maxFallHeight;
          let fallHeight =
            (1 - (score - lowestScore) / (maxScore - lowestScore)) *
            maxFallHeight;

          // console.log(`${rankingArr[i].player} falls ${fallHeight}vw!`);

          $playerPiece.css({
            transform: `translateY(${fallHeight}vw)`
          });

          if (score == maxScore) {
            setTimeout(() => {
              $playerPiece.addClass("winner");
            }, 1000);
          }
        }

        setTimeout(() => {
          if (!App.muted) {
            App.successJingle.play();
          }
        }, 1000);
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
      }

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
