const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  gameId: {
    type: String,
    required: true,
    uppercase: true
  },
  players: {
    type: Array,
    required: true
  },
  date: Date,
  finished: {
    type: Boolean,
    default: false
  }
});

const Game = mongoose.model("Game", GameSchema);
module.exports = Game;