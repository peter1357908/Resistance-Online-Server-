import mongoose, { Schema } from 'mongoose';

const RoundSchema = new Schema({
  currentLeaderID: String,
  proposedTeam: [String], // an array of playerIDs
  // TODO: keep track of who voted what for who goes on the mission
  voteByPlayerIndex: [String], // 'APPROVE' or 'REJECT' by index into the playerIDs; needs to initialized to be the same size as playerIDs, with 'TBD' as each entry
  roundOutcome: String, // `APPROVED`, `REJECTED`
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
});

// create model class
const RoundModel = mongoose.model('Round', RoundSchema, 'rounds');

export default RoundModel;
