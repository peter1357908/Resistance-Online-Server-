import mongoose, { Schema } from 'mongoose';

const MissionSchema = new Schema({
  missionTeam: [String], // an array of playerIDs; redundant info because this can be inferred from the last round
  rounds: [{ type: Schema.Types.ObjectId, ref: 'Round' }],
  missionSize: Number,
  voteByPlayerIndex: [String], // 'SUCCEED' or 'FAIL' by index into the playerIDs; needs to initialized to be the same size as playerIDs, with 'TBD' as each entry
  missionOutcome: String, // 'SUCCEEDED' or 'FAILED'
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
});

// create model class
const MissionModel = mongoose.model('Mission', MissionSchema, 'missions');

export default MissionModel;
