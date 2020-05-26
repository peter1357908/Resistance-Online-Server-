import mongoose, { Schema } from 'mongoose';

const RoundSchema = new Schema({
  currentLeader: { type: Schema.Types.ObjectId, ref: 'Player' },
  proposedTeam: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  teamSize: { type: Number, default: 0 },
  totalVotes: { type: Number, default: 0 },
  approvedVotes: { type: Number, default: 0 },
  rejectedVotes: { type: Number, default: 0 },
  proposalOutcome: { type: String, default: 'None' },
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
});

// create model class
const RoundModel = mongoose.model('Round', RoundSchema, 'rounds');

export default RoundModel;
