import mongoose, { Schema } from 'mongoose';

const MissionSchema = new Schema({
  missionTeam: [String], // an array of playerIDs
  currentRound: Number,
  rounds: [{ type: Schema.Types.ObjectId, ref: 'Round' }],
  missionSize: Number,
  // TODO: keep track of who voted what for who goes on the mission
  votes: [{
    playerID: String,
    voteType: String, // 'SUCCEED' or 'FAIL'
  }],
  missionOutcome: String, // 'SUCCESS' or 'FAIL'
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
});

// create model class
const MissionModel = mongoose.model('Mission', MissionSchema, 'missions');

export default MissionModel;
