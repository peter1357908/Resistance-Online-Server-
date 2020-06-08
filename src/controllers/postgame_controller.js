import Game from '../models/game_model';
import Player from '../models/player_model';
import updateWaitingFor from './ingame_controller';

// postgame_controller should have more functions
// eslint-disable-next-line import/prefer-default-export
export const finishViewingGameHistory = (socketID) => {
  let annoucingPlayer;
  let numCurrentlyWaiting;
  return Player.findOne({ socketID })
    .then((foundPlayer) => {
      if (foundPlayer === null) {
        throw new Error('You must have bypassed the front-end to try announcing that you finished viewing game history without being a player... Nice try.');
      }
      annoucingPlayer = foundPlayer;
      return Game.findOne({ sessionID: foundPlayer.sessionID });
    })
    .then((foundGame) => {
      if (foundGame === null || foundGame.currentExpectedInGameAction !== 'finishViewingGameHistory') {
        throw new Error('You must have bypassed the front-end to try announcing that you finished viewing game history without being asked to... Nice try.');
      }
      numCurrentlyWaiting = updateWaitingFor(annoucingPlayer.playerID, foundGame);
      if (numCurrentlyWaiting === null) {
        throw new Error('You must have bypassed the front-end to try announcing that you finished viewing game history after already annoucing once... Nice try.');
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
        return newMission(savedGame)
          .then((newMissionInfo) => {
            return {
              action: 'everyoneViewedFaction',
              waitingFor: [],
              sessionID: newMissionInfo.sessionID,
              currentLeaderID: newMissionInfo.currentLeaderID,
              currentMission: newMissionInfo.currentMissionIndex + 1,
              currentRound: newMissionInfo.currentRoundIndex + 1,
              missionSize: newMissionInfo.missionSize,
            };
          })
          .catch((error) => { throw error; });
      }
    })
    .catch((error) => { throw error; });
};
