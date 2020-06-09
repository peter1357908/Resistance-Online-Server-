import Game from '../models/game_model';
import Player from '../models/player_model';
import { updateWaitingFor } from './ingame_controller';
import Mission from '../models/mission_model';
import Round from '../models/round_model';

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

      let { waitingFor } = foundGame;
      return foundGame.populate('missions', 'rounds').execPopulate()
        .then((populatedGame) => {
          if (numCurrentlyWaiting === 0) {
            // reset the game states just enough... most would be reset by startGame() <but ideally the info from last game, like victoriousFaction should ALL be removed>
            // (as it turns out, setting inLobby to `true` alone is enough... deleting the missions and rounds is actually optional, but clean-up is good...)
            // (also, we do not need to wait on the missions and rounds being deleted; no need to be async here)

            for (let i = 0; i < populatedGame.missions.length; i += 1) {
              const populatedMission = populatedGame.missions[i];
              for (let j = 0; j < populatedMission.rounds.length; j += 1) {
                Round.findByIdAndRemove(populatedMission.rounds[j]).catch((error) => { throw error; });
              }
              Mission.findByIdAndRemove(populatedMission._id).catch((error) => { throw error; });
            }

            foundGame.inLobby = true;

            waitingFor = []; // the waitingFor was auto-refilled; set the one being sent as an empty array
          }
          return foundGame.save();
        })
        .then((savedGame) => {
          return {
            action: 'waitingFor',
            sessionID: savedGame.sessionID,
            waitingFor,
          };
        })
        .catch((error) => { throw error; });
    })
    .catch((error) => { throw error; });
};
