import mongoose, { Schema } from 'mongoose';

const PlayerSchema = new Schema({
  playerID: String,
  socketID: String,
  sessionID: String,
  faction: {type: String, default: "RESISTANCE"}, // Either 'RESISTANCE' or 'SPY'
}, {
  toObject: { virtuals: true }, // why?
  toJSON: { virtuals: true }, // why?
});

// create model class
const PlayerModel = mongoose.model('Player', PlayerSchema, 'players');

export default PlayerModel;
