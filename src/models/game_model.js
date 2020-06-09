import mongoose, { Schema } from 'mongoose';

const GameSchema = new Schema({
  sessionID: String,
  password: String,
  creatorID: String,

  playerIDs: [String],
  currentLeaderIndex: Number, // initialized to be -1 to be clever... for use directly in newMission() [newRound() should not have been the first one to access this value]
  waitingFor: [String], // playerIDs
  spies: [String], // playerIDs
  // waitingForIndex: [Number],
  // spiesIndex: [Number],

  victoriousFaction: String, // 'RESISTANCE' / 'SPY'
  missions: [{ type: Schema.Types.ObjectId, ref: 'Mission' }],
  currentMissionIndex: Number, // initialized to be -1 to be clever... for use directly in newMission(). Redundant; can be inferred from the length of `missions`.
  currentRoundIndex: Number,

  inLobby: Boolean,
  currentExpectedInGameAction: String, // also used for 'finishViewingGameHistory', which is postGame... TODO: naming refactoring

  chatLog: [[String]], // an array of 2-element arrays; each inner array is of format [messageFrom, message]... might actually need to be its own schema so that we are not grabbing the full content every time...
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
});

// create model class
const GameModel = mongoose.model('Game', GameSchema, 'games');

export default GameModel;
