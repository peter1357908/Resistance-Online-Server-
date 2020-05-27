import mongoose, { Schema } from 'mongoose';

const GameSchema = new Schema({
  sessionID: String,
  password: String,
  creator: { type: Schema.Types.ObjectId, ref: 'Player' },
  players: [{ type: Schema.Types.ObjectId, ref: 'Player' }], // controllers boutta get fricked
  spies: [Number],
  resistance: [Number],
  missions: [{ type: Schema.Types.ObjectId, ref: 'Mission' }],
}, {
  toObject: { virtuals: true }, // why?
  toJSON: { virtuals: true }, // why?
});

// create model class
const GameModel = mongoose.model('Game', GameSchema, 'games');

export default GameModel;
