import mongoose, { Schema } from 'mongoose';

const GameSchema = new Schema({
  sessionID: String,
  password: String,
  creatorID: String,

  playerIDs: [String],
  currentLeaderIndex: Number,
  waitingFor: [String], // playerIDs
  spies: [String], // playerIDs
  // waitingForIndex: [Number],
  // spiesIndex: [Number],

  victoriousFaction: String, // 'RESISTANCE' / 'SPY'
  missions: [{ type: Schema.Types.ObjectId, ref: 'Mission' }],
  currentMissionIndex: Number, // initialized to be -1 to be clever... for use directly in newMission().
  currentRoundIndex: Number, // TODO: currently redundant - same as currentLeaderIndex

  inLobby: Boolean,
  currentExpectedInGameAction: String, // also used for 'finishViewingGameHistory', which is postGame... TODO: naming refactoring

  chatLog: [{ playerID: String, message: String }],
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
});

// create model class
const GameModel = mongoose.model('Game', GameSchema, 'games');

export default GameModel;
