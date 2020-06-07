import Game from '../models/game_model';
import Player from '../models/player_model';
import Mission from '../models/mission_model';
import Round from '../models/round_model';
import MissionSizes from '../resources/mission_sizes';

// --------------------------------------------------------------------------
// Helper Functions
const newMission = (sessionID) => {
  let gameBeforeSave;
  let missionAfterSave;
  return Game.findOne({ sessionID })
    .then((foundGame) => {
      gameBeforeSave = foundGame;
      const round = new Round();
      [round.currentLeaderID] = foundGame.playerIDs;
      return round.save();
    })
    .then((savedNewRound) => {
      const mission = new Mission();
      mission.missionSize = MissionSizes[gameBeforeSave.playerIDs.length][gameBeforeSave.currentMissionIndex + 1];
      mission.rounds = [savedNewRound._id];
      return mission.save();
    })
    .then((savedNewMission) => {
      missionAfterSave = savedNewMission;
      gameBeforeSave.currentMissionIndex += 1;
      gameBeforeSave.currentRoundIndex = 0;
      gameBeforeSave.currentLeaderIndex = 0;
      gameBeforeSave.missions.push(savedNewMission._id);
      return gameBeforeSave.save();
    })
    .then((savedGame) => {
      return {
        sessionID: savedGame.sessionID,
        currentLeaderID: savedGame.playerIDs[savedGame.currentLeaderIndex],
        currentMissionIndex: savedGame.currentMissionIndex,
        currentRoundIndex: savedGame.currentRoundIndex,
        missionSize: missionAfterSave.missionSize,
      };
    })
    .catch((error) => { throw error; });
};

const newRound = (sessionID) => {
  let gameBeforeSave;
  let roundAfterSave;
  let missionAfterSave;
  return Game.findOne({ sessionID })
    .then((foundGame) => {
      gameBeforeSave = foundGame;
      const round = new Round();
      round.currentLeaderID = foundGame.playerIDs[foundGame.currentLeaderIndex + 1];
      return round.save();
    })
    .then((savedNewRound) => {
      roundAfterSave = savedNewRound;
      Mission.findById(gameBeforeSave.missions[gameBeforeSave.currentMissionIndex]);
    })
    .then((foundCurrentMission) => {
      foundCurrentMission.rounds.push(roundAfterSave._id);
      return foundCurrentMission.save();
    })
    .then((savedCurrentMission) => {
      missionAfterSave = savedCurrentMission;
      gameBeforeSave.currentRoundIndex += 1;
      gameBeforeSave.currentLeaderIndex += 1;
      return gameBeforeSave.save();
    })
    .then((savedGame) => {
      return {
        sessionID: savedGame.sessionID,
        currentLeaderID: savedGame.playerIDs[savedGame.currentLeaderIndex],
        currentMissionIndex: savedGame.currentMissionIndex,
        currentRoundIndex: savedGame.currentRoundIndex,
        missionSize: missionAfterSave.missionSize,
      };
    })
    .catch((error) => { throw error; });
};

// returns null if waitingFor did not change
// otherwise, returns the number of players still waiting.
// waitingFor will be "refilled" when no more players are waiting
const updateWaitingFor = (playerID, foundGame) => {
  // check if the waitingFor would change
  const numPreviouslyWaiting = foundGame.waitingFor.length;
  foundGame.waitingFor.pull(playerID);
  const numCurrentlyWaiting = foundGame.waitingFor.length;
  if (numPreviouslyWaiting === numCurrentlyWaiting) {
    return null;
  }
  // check if waitingFor would need to be "refilled"
  if (numCurrentlyWaiting === 0) {
    foundGame.waitingFor = foundGame.playerIDs.slice(0);
  }
  return numCurrentlyWaiting;
};

// --------------------------------------------------------------------------
// Message Handling Functions (function name should be the same as the action it handles)
export const factionViewed = (socketID) => {
  let annoucingPlayer;
  let numCurrentlyWaiting;
  return Player.findOne({ socketID })
    .then((foundPlayer) => {
      if (foundPlayer === null) {
        throw new Error('You must have bypassed the front-end to try announcing that you viewed faction at the wrong time... Nice try.');
      }
      annoucingPlayer = foundPlayer;
      return Game.findOne({ sessionID: foundPlayer.sessionID });
    })
    .then((foundGame) => {
      if (foundGame === null || foundGame.currentExpectedInGameAction !== 'factionViewed') {
        throw new Error('You must have bypassed the front-end to try announcing that you viewed faction at the wrong time... Nice try.');
      }
      numCurrentlyWaiting = updateWaitingFor(annoucingPlayer.playerID, foundGame);
      if (numCurrentlyWaiting === null) {
        throw new Error('Be patient... Clicking it once is enough...');
        // TODO: update front-end to hide OK button
        // throw new Error('You must have bypassed the front-end to try announcing that you viewed faction after already annoucing once... Nice try.');
      }
      if (numCurrentlyWaiting === 0) {
        foundGame.currentExpectedInGameAction = 'proposeTeam';
      }
      return foundGame.save();
    })
    .then((savedGame) => {
      if (numCurrentlyWaiting !== 0) {
        return {
          action: 'waitingFor',
          sessionID: savedGame.sessionID,
          waitingFor: savedGame.waitingFor,
        };
      } else {
        return newMission(savedGame.sessionID)
          .then((newMissionInfo) => {
            return {
              action: 'everyoneViewedFaction',
              waitingFor: [],
              sessionID: newMissionInfo.sessionID,
              currentLeaderID: newMissionInfo.currentLeaderID,
              currentMission: newMissionInfo.currentMissionIndex + 1,
              missionSize: newMissionInfo.missionSize,
              currentRound: newMissionInfo.currentRoundIndex + 1,
            };
          })
          .catch((error) => { throw error; });
      }
    })
    .catch((error) => { throw error; });
};

export const proposeTeam = (fields, socketID) => {
  let proposingPlayer;
  return Player.findOne({ socketID })
    .then((foundPlayer) => {
      proposingPlayer = foundPlayer;
      return Game.findOne({ sessionID: foundPlayer.sessionID });
    })
    .then((foundGame) => {
      if (foundGame.currentExpectedInGameAction !== 'proposeTeam'
        || foundGame.playerIDs[foundGame.currentLeaderIndex] !== proposingPlayer.playerID) {
        throw new Error('You must have bypassed the front-end to propose a team without being asked to... Nice try.');
      }

      for (let i = 0; i < fields.proposedTeam.length; i += 1) {
        if (!foundGame.playerIDs.includes(fields.proposedTeam[i])) {
          throw new Error('You must have bypassed the front-end to propose a team with some made-up players... Nice try.');
        }
      }
      return {
        action: 'proposeTeam',
        sessionID: foundGame.sessionID,
        proposedTeam: fields.proposedTeam,
      };
    }).catch((error) => { throw error; });
};

export const newChat = (socketID, fields) => {
  return Player.findOne({ socketID })
    .then((foundPlayer) => {
      return Game.findOne({ sessionID: foundPlayer.sessionID });
    })
    .then((foundGame) => {
      foundGame.logs.push({ playerID: fields.messageFrom, message: fields.message });
      return foundGame.save();
    })
    .then((savedGame) => {
      return { sessionID: savedGame.sessionID, logs: savedGame.logs };
    })
    .catch((error) => { throw error; });
};
