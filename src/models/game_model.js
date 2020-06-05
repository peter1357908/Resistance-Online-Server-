import mongoose, { Schema } from 'mongoose';

const GameSchema = new Schema({
  sessionID: String,
  password: String,
  creatorID: String,
  currentLeaderIndex: { type: Number, default: 0 },
  players: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  waitingFor: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  // the following is currently kept track of in the player model
  spies: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  missions: [{ type: Schema.Types.ObjectId, ref: 'Mission' }],
  inLobby: { type: Boolean, default: true },
  currentMissionIndex: { type: Number, default: 0 },
  logs: [{ playerID: String, message: String }],
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
});

// create model class
const GameModel = mongoose.model('Game', GameSchema, 'games');

export default GameModel;
