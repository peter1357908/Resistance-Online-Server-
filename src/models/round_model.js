import mongoose, { Schema } from 'mongoose';

const RoundSchema = new Schema({
  currentLeaderID: String,
  proposedTeam: [String], // an array of playerIDs
  // TODO: keep track of who voted what for who goes on the mission
  votes: [{
    playerID: String,
    voteType: String, // 'APPROVE' or 'REJECT'
  }],
  proposalOutcome: String, // `APPROVED`, `REJECTED`
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
});

// create model class
const RoundModel = mongoose.model('Round', RoundSchema, 'rounds');

export default RoundModel;
