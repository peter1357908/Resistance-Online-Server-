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
      for (let i = 0; i < foundGame.playerIDs.length; i += 1) {
        round.voteByPlayerIndex.push('TBD');
      }
      return round.save();
    })
    .then((savedNewRound) => {
      const mission = new Mission();
      mission.missionSize = MissionSizes[gameBeforeSave.playerIDs.length][gameBeforeSave.currentMissionIndex + 1];
      mission.rounds = [savedNewRound._id];
      for (let i = 0; i < gameBeforeSave.playerIDs.length; i += 1) {
        mission.voteByPlayerIndex.push('TBD');
      }
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
  return Game.findOne({ sessionID })
    .then((foundGame) => {
      gameBeforeSave = foundGame;
      const round = new Round();
      round.currentLeaderID = foundGame.playerIDs[foundGame.currentLeaderIndex + 1];
      for (let i = 0; i < foundGame.playerIDs.length; i += 1) {
        round.voteByPlayerIndex.push('TBD');
      }
      return round.save();
    })
    .then((savedNewRound) => {
      roundAfterSave = savedNewRound;
      return Mission.findById(gameBeforeSave.missions[gameBeforeSave.currentMissionIndex]);
    })
    .then((foundCurrentMission) => {
      foundCurrentMission.rounds.push(roundAfterSave._id);
      return foundCurrentMission.save();
    })
    .then((savedCurrentMission) => {
      gameBeforeSave.currentRoundIndex += 1;
      gameBeforeSave.currentLeaderIndex += 1;
      return gameBeforeSave.save();
    })
    .then((savedGame) => {
      return {
        sessionID: savedGame.sessionID,
        currentLeaderID: savedGame.playerIDs[savedGame.currentLeaderIndex],
        currentRoundIndex: savedGame.currentRoundIndex,
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
        throw new Error('You must have bypassed the front-end to try announcing that you viewed faction without being a player... Nice try.');
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
        throw new Error('You must have bypassed the front-end to try announcing that you viewed faction after already annoucing once... Nice try.');
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
  let gameBeforeSave;
  let roundAfterSave;
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
      gameBeforeSave = foundGame;

      return Mission.findById(foundGame.missions[foundGame.currentMissionIndex]);
    })
    .then((foundCurrentMission) => {
      return Round.findById(foundCurrentMission.rounds[gameBeforeSave.currentRoundIndex]);
    })
    .then((foundCurrentRound) => {
      foundCurrentRound.proposedTeam = fields.proposedTeam;

      return foundCurrentRound.save();
    })
    .then((savedCurrentRound) => {
      roundAfterSave = savedCurrentRound;
      gameBeforeSave.currentExpectedInGameAction = 'voteOnTeamProposal';
      return gameBeforeSave.save();
    })
    .then((savedGame) => {
      return {
        action: 'proposeTeam',
        sessionID: savedGame.sessionID,
        proposedTeam: roundAfterSave.proposedTeam,
      };
    })
    .catch((error) => { throw error; });
};

export const voteOnTeamProposal = (fields, socketID) => {
  let votingPlayer;
  let numCurrentlyWaiting;
  let gameAfterSave;
  if (fields.voteType !== 'APPROVE' && fields.voteType !== 'REJECT') {
    return new Promise((resolve, reject) => {
      reject(new Error('You must have bypassed the front-end to try sending a bad vote for team proposal... Nice try.'));
    });
  }

  return Player.findOne({ socketID })
    .then((foundPlayer) => {
      if (foundPlayer === null) {
        throw new Error('You must have bypassed the front-end to try voting on team proposal without being a player... Nice try.');
      }
      votingPlayer = foundPlayer;
      return Game.findOne({ sessionID: foundPlayer.sessionID });
    })
    .then((foundGame) => {
      if (foundGame === null || foundGame.currentExpectedInGameAction !== 'voteOnTeamProposal') {
        throw new Error('You must have bypassed the front-end to try voting on team proposal at the wrong time... Nice try.');
      }
      numCurrentlyWaiting = updateWaitingFor(votingPlayer.playerID, foundGame);
      if (numCurrentlyWaiting === null) {
        throw new Error('You must have bypassed the front-end to try voting on team proposal after already voting once... Nice try.');
      }
      if (numCurrentlyWaiting === 0) {
        foundGame.currentExpectedInGameAction = 'votesViewed';
      }
      return foundGame.save();
    })
    .then((savedGame) => {
      gameAfterSave = savedGame;
      return Mission.findById(savedGame.missions[savedGame.currentMissionIndex]);
    })
    .then((foundCurrentMission) => {
      return Round.findById(foundCurrentMission.rounds[gameAfterSave.currentRoundIndex]);
    })
    .then((foundCurrentRound) => {
      // https://stackoverflow.com/questions/24618584/mongoose-save-not-updating-value-in-an-array-in-database-document
      // BAD ATTEMPT: foundCurrentRound.voteByPlayerIndex[gameAfterSave.playerIDs.indexOf(votingPlayer.playerID)] = fields.voteType;
      foundCurrentRound.voteByPlayerIndex.set(gameAfterSave.playerIDs.indexOf(votingPlayer.playerID), fields.voteType);
      if (numCurrentlyWaiting === 0) {
        // all votes are cast; check if the team proposal has been approved or rejected
        const numTotalVotes = foundCurrentRound.voteByPlayerIndex.length; // at this point should be the same as the number of players
        let numRejectVotes = 0;
        for (let i = 0; i < numTotalVotes; i += 1) {
          if (foundCurrentRound.voteByPlayerIndex[i] === 'REJECT') { numRejectVotes += 1; }
        }
        if (numRejectVotes >= numTotalVotes / 2.0) {
          foundCurrentRound.roundOutcome = 'REJECTED';
        } else {
          foundCurrentRound.roundOutcome = 'APPROVED';
        }
      }
      return foundCurrentRound.save();
    })
    .then((savedCurrentRound) => {
      if (numCurrentlyWaiting !== 0) {
        return {
          action: 'waitingFor',
          sessionID: gameAfterSave.sessionID,
          waitingFor: gameAfterSave.waitingFor,
        };
      } else {
        let failedMission = null; // set to be the failed mission if... a mission has failed due to 5 rejected team proposals
        // TODO: no magic numbers
        if (gameAfterSave.currentRoundIndex >= 4) {
          // TODO: a bit semantically ambiguous... here we send the message, but only set the status later in votesViewed()
          failedMission = gameAfterSave.currentMissionIndex + 1;
        }

        // compose the voteComposition
        const voteComposition = {};
        for (let i = 0; i < gameAfterSave.playerIDs.length; i += 1) {
          voteComposition[gameAfterSave.playerIDs[i]] = savedCurrentRound.voteByPlayerIndex[i];
        }

        return {
          action: 'roundVotes',
          sessionID: gameAfterSave.sessionID,
          waitingFor: [],
          voteComposition,
          roundOutcome: savedCurrentRound.roundOutcome,
          concludedRound: gameAfterSave.currentRoundIndex + 1,
          failedMission,
        };
      }
    })
    .catch((error) => { throw error; });
};

// special function that is its own event (`chat`, instead of being targeted at `lobby` or `in-game` or such)
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
