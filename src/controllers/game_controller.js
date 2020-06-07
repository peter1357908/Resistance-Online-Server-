import Game from '../models/game_model';
import Player from '../models/player_model';
import Mission from '../models/mission_model';
import Round from '../models/round_model';
import MissionSizes from '../resources/mission_sizes';

/***************** Helper Functions *****************/
const newMission = (sessionID) => {
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
              missionSize: savedNewMission.missionSize,
              // missionID: newMission._id,
            };
          }).catch((error) => { throw error; });
        }).catch((error) => { throw error; });
      }).catch((error) => { throw error; });
    }).catch((error) => { throw error; });
  }).catch((error) => { throw error; });
};

// returns null if waitingFor did not change
// otherwise, returns the number of players still waiting.
// waitingFor will be "refilled" when no more players are waiting
const updateWaitingFor = (playerObjectId, foundGame) => {
  // check if the waitingFor would change
  const numPreviouslyWaiting = foundGame.waitingFor.length;
  foundGame.waitingFor.pull(playerObjectId);
  const numCurrentlyWaiting = foundGame.waitingFor.length;
  if (numPreviouslyWaiting === numCurrentlyWaiting) {
    return null;
  }

  // check if waitingFor would need to be "refilled"
  if (numCurrentlyWaiting === 0) {
    foundGame.waitingFor = foundGame.players.slice(0);
  }

  return numCurrentlyWaiting;
}

/***************** Message Handling Functions *****************/
export const factionViewed = (socketID) => {
  return Player.findOne({ socketID }).then((foundPlayer) => {
    return Game.findOne({ sessionID: foundPlayer.sessionID })
      .populate('players', 'playerID')
      .then((foundGame) => {
        updateWaitingFor
        return foundGame.save().then(async (savedGame) => {
          if (savedGame.waitingFor.length !== 0) {
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
              currentLeaderID: populatedGame.fields.currentLeaderIndex,
              currentMission: fields.currentMissionIndex,
              missionSize: fields.missionSize,
              currentRound: fields.currentRoundIndex,
            };
          }
      }).catch((error) => { throw error; });
    }).catch((error) => { throw error; });
  }).catch((error) => { throw error; });
};

export const proposeTeam = (fields, socketID) => {
  return Player.findOne({ socketID }).then((foundPlayer) => {
    return Game.findOne({ sessionID: foundPlayer.sessionID })
      .populate('players', 'playerID')
      .then((foundGame) => {
        if (foundGame.currentExpectedInGameAction != 'proposeTeam' ||
            foundGame.players[foundGame.currentLeaderIndex] != foundPlayer._id) {
          return { action: 'noAction' };
        }

        for (let proposedPlayerID in fields.proposedTeam) {
          // note that foundGame.players is already populated
          if (!foundGame.players.includes(proposedPlayerID)) {
            return { action: 'noAction' };
          }
        }
        
        return {
          action: 'proposeTeam',
          proposedTeam: fields.proposedTeam,
        }
      }).catch((error) => { throw error; });
  }).catch((error) => { throw error; });
}

export const newChat = (socketID, fields) => {
  return Player.findOne({ socketID }).then((foundPlayer) => {
    return Game.findOne({ sessionID: foundPlayer.sessionID }).then((foundGame) => {
      foundGame.logs.push({ playerID: fields.messageFrom, message: fields.message });
      return foundGame.save().then((savedGame) => {
        return { sessionID: savedGame.sessionID, logs: savedGame.logs };
      }).catch((error) => { throw error; });
    }).catch((error) => { throw error; });
  }).catch((error) => { throw error; });
};