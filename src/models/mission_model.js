import mongoose, { Schema } from 'mongoose';

const MissionSchema = new Schema({
  missionTeam: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  currentRound: { type: Schema.Types.ObjectId, ref: 'Round' },
  rounds: [{ type: Schema.Types.ObjectId, ref: 'Round' }],
  totalVotes: { type: Number, default: 0 },
  successVotes: { type: Number, default: 0 },
  failVotes: { type: Number, default: 0 },
  missionOutcome: { type: String, default: 'None' },
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
});

// create model class
const MissionModel = mongoose.model('Mission', MissionSchema, 'missions');

export default MissionModel;
