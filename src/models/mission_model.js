import mongoose, { Schema } from 'mongoose';

const MissionSchema = new Schema({
  missionTeam: [String], // an array of playerIDs
  rounds: [{ type: Schema.Types.ObjectId, ref: 'Round' }],
  missionSize: Number,
  // TODO: keep track of who voted what for who goes on the mission
  voteByPlayerIndex: [String], // 'SUCCESS' or 'FAIL' by index into the playerIDs; needs to initialized to be the same size as playerIDs, with 'TBD' as each entry
  missionOutcome: String, // 'SUCCESS' or 'FAIL'
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
});

// create model class
const MissionModel = mongoose.model('Mission', MissionSchema, 'missions');

export default MissionModel;
