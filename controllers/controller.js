const Game = require("../models/games");

// Create and Save a new Game
exports.create = (req, res) => {
    // Validate request
    if (!req.body.gameId) {
        res.status(400).send({ message: "gameId can not be empty!" });
        return;
    }
  
    // Create a Game
    const gameEntry = new Game({
        gameId: req.body.gameId,
        players: req.body.players,
        date: new Date,
        winner: req.body.winner ? winner : []
    });
  
    // Save Game in the database
    gameEntry
        .save(gameEntry)
        .then(data => {
            res.send(data);
      })
        .catch(err => {
            res.status(500).send({
            message:
                err.message || "Some error occurred while creating the Game."
            });
      });
  };

// Retrieve all Games from the database.
exports.findAll = (req, res) => {
  
};

// Update a Game by the id in the request
exports.update = (req, res) => {
  
};