import Game from '../models/game_model';
import Player from '../models/player_model';
import Mission from '../models/mission_model';
import Round from '../models/round_model';
import MissionSizes from '../resources/mission_sizes';

export const heardFrom = (socketID) => {
  return Player.findOne({ socketID }).then((foundPlayer) => {
    return Game.findOne({ sessionID: foundPlayer.sessionID }).then((foundGame) => {
      foundGame.waitingFor.pull(foundPlayer._id);
      return foundGame.save().then(async (savedGame) => {
        if (savedGame.waitingFor.length !== 0){
          return savedGame.populate('waitingFor').execPopulate().then((populatedGame) => {
            const playerIDs = populatedGame.waitingFor.map((playerObject) => {
              return playerObject.playerID;
            });
            return {
              message: 'waitingFor',
              sessionID: populatedGame.sessionID,
              waitingFor: playerIDs,
            };
          }).catch((error) => { throw error; });
        } else {
          const fields = await newMission(savedGame.sessionID);
          console.log('fields returned from first mission', fields);
          return {
            message: 'everyoneJoined',
            waitingFor: [],
            sessionID: savedGame.sessionID,
            currentLeaderIndex: fields.currentLeaderIndex,
            currentMission: fields.currentMissionIndex,
            currentRound: fields.currentRoundIndex,
          }
        }
      }).catch((error) => { throw error; });
    }).catch((error) => { throw error; });
  }).catch((error) => { throw error; });
};


// export const newMission = (socketID) => {
//   return Player.findOne({ socketID }).then((foundPlayer) => {
//     return Game.findOne({ sessionID: foundPlayer.sessionID }).then((foundGame) => {
//       const round = new Round();
//       const leaderObject = foundGame.players[foundGame.currentLeaderIndex];
//       round.currentLeaderID = leaderObject.playerID;
//       return round.save().then((newRound) => {
//         const mission = new Mission();
//         [mission.missionSize] = MissionSizes[foundGame.players.length];
//         // mission.missionSize = MissionSizes[foundGame.players.length][0];
//         mission.currentRound = 0;
//         mission.rounds = [newRound._id];
//         return mission.save().then((newMission) => {
//           foundGame.missions.push(newMission._id);
//           foundGame.currentMissionIndex = foundGame.missions.length - 1;
//           foundGame.save().then((savedGame) => {
//             return {
//               sessionID: foundGame.sessionID,
//               currentLeaderID: newRound.currentLeaderID,
//               currentMissionIndex: savedGame.currentMissionIndex,
//               currentRoundIndex: 0,
//               missionID: newMission._id,
//             };
//           }).catch((error) => { throw error; });
//         }).catch((error) => { throw error; });
//       }).catch((error) => { throw error; });
//     }).catch((error) => { throw error; });
//   }).catch((error) => { throw error; });
// };


export const newMission = (sessionID) => {
  return Game.findOne({ sessionID }).then((foundGame) => {
    return foundGame.populate('players').execPopulate().then((populatedGame) => {
      const round = new Round();
      const leaderObject = populatedGame.players[populatedGame.currentLeaderIndex]; // could be tricky later
      console.log('leaderObject: ', leaderObject);
      round.currentLeaderID = leaderObject.playerID;
      console.log('round currentLEaderID', round.currentLeaderID);
      return round.save().then((newRound) => {
        const mission = new Mission();
        [mission.missionSize] = MissionSizes[populatedGame.players.length];
        console.log('mission size', mission.missionSize);
        // mission.missionSize = MissionSizes[foundGame.players.length][0];
        mission.currentRound = 0;
        mission.rounds = [newRound._id];
        return mission.save().then((savedNewMission) => {
          populatedGame.missions.push(savedNewMission._id);
          populatedGame.currentMissionIndex = foundGame.missions.length - 1;
          return populatedGame.save().then((savedGame) => {
            return {
              sessionID: savedGame.sessionID,
              currentLeaderID: newRound.currentLeaderID,
              currentLeaderIndex: savedGame.currentLeaderIndex,
              currentMissionIndex: savedGame.currentMissionIndex,
              currentRoundIndex: 0,
              // missionID: newMission._id,
            };
          }).catch((error) => { throw error; });
        }).catch((error) => { throw error; });
      }).catch((error) => { throw error; });
    }).catch((error) => { throw error; });
  }).catch((error) => { throw error; });
};

// export const newMission2 = (sessionID) => {
//   return Game.findOne({ sessionID: sessionID }).then((foundGame) => {
//     return foundGame.populate('players').execPopulate().then((populatedGame) => {
//       const round = new Round();
//       const leaderObject = populatedGame.players[populatedGame.currentLeaderIndex]; // could be tricky later
//       console.log('leaderObject: ', leaderObject);
//       round.currentLeaderID = leaderObject.playerID;
//       console.log('round currentLEaderID', round.currentLeaderID);
//       // return {
//       //   random: 'test',
//       //   newrandom: 'test2'
//       // }

//       return round.save().then((newRound) => {
//         const mission = new Mission();
//         [mission.missionSize] = MissionSizes[populatedGame.players.length];
//         console.log('mission size', mission.missionSize);
//         // mission.missionSize = MissionSizes[foundGame.players.length][0];
//         mission.currentRound = 0;
//         mission.rounds = [newRound._id];
//         return mission.save().then((newMission) => {
//           populatedGame.missions.push(newMission._id);
//           populatedGame.currentMissionIndex = foundGame.missions.length - 1;
//           return populatedGame.save().then((savedGame) => {
//             return {
//               sessionID: savedGame.sessionID,
//               currentLeaderID: newRound.currentLeaderID,
//               currentLeaderIndex: savedGame.currentLeaderIndex,
//               currentMissionIndex: savedGame.currentMissionIndex,
//               currentRoundIndex: 0,
//               // missionID: newMission._id,
//             };
//           }).catch((error) => { throw error; });
//         }).catch((error) => { throw error; });
//       }).catch((error) => { throw error; });
//     }).catch((error) => { throw error; })
//   }).catch((error) => { throw error; });
// };
