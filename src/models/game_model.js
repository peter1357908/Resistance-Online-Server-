import mongoose, { Schema } from 'mongoose';

const GameSchema = new Schema({
  sessionID: String,
  password: String,
  creatorID: String,
  players: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  // playerNames: [String],
  // the following are currently kept track of in the player model
  spies: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  // resistance: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  missions: [{ type: Schema.Types.ObjectId, ref: 'Mission' }],
  inLobby: Boolean,
}, {
  toObject: { virtuals: true }, // why?
  toJSON: { virtuals: true }, // why?
});

// create model class
const GameModel = mongoose.model('Game', GameSchema, 'games');

export default GameModel;
