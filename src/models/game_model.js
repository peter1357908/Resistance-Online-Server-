import mongoose, { Schema } from 'mongoose';

const GameSchema = new Schema({
  sessionID: String,
  password: String,
  creatorID: String,

  players: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  currentLeaderIndex: Number,
  waitingFor: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  spies: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  // waitingForIndex: [Number],
  // spiesIndex: [Number],

  missions: [{ type: Schema.Types.ObjectId, ref: 'Mission' }],
  currentMissionIndex: Number,

  inLobby: Boolean,
  currentExpectedInGameAction: String,

  logs: [{ playerID: String, message: String }],
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
});

// create model class
const GameModel = mongoose.model('Game', GameSchema, 'games');

export default GameModel;
