import mongoose, { Schema } from 'mongoose';

const GameSchema = new Schema({
  sessionID: String,
  creator: String,
  playerIDs: [String],
  numPlayers: Number,
}, {
  toObject: { virtuals: true }, // why?
  toJSON: { virtuals: true }, // why?
});

// create model class
const GameModel = mongoose.model('Game', GameSchema, 'games');

export default GameModel;
