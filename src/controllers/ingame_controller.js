import Game from '../models/game_model';
import Player from '../models/player_model';
import Mission from '../models/mission_model';
import Round from '../models/round_model';
import MissionSizes from '../resources/mission_sizes';

// --------------------------------------------------------------------------
// Helper Functions
// IMPORTANT: newMission() will modify and save the input `gameBeforeSave`!
// (including setting its currentExpectedInGameAction as 'proposeTeam'!)
const newMission = (gameBeforeSave) => {
  let missionAfterSave;
  gameBeforeSave.currentLeaderIndex += 1;
  if (gameBeforeSave.currentLeaderIndex >= gameBeforeSave.playerIDs.length) { gameBeforeSave.currentLeaderIndex = 0; }
  const round = new Round();
  round.currentLeaderID = gameBeforeSave.playerIDs[gameBeforeSave.currentLeaderIndex];
  for (let i = 0; i < gameBeforeSave.playerIDs.length; i += 1) {
    round.voteByPlayerIndex.push('TBD');
  }
  return round.save()
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
      gameBeforeSave.missions.push(savedNewMission._id);
      gameBeforeSave.currentExpectedInGameAction = 'proposeTeam';
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

// IMPORTANT: newRound() will modify and save the input `gameBeforeSave`!
// (including setting its currentExpectedInGameAction as 'proposeTeam'!)
// does not do input check; otherwise could check for things like "round index should go above 4"
const newRound = (gameBeforeSave) => {
  let roundAfterSave;
  let missionAfterSave;
  gameBeforeSave.currentLeaderIndex += 1;
  if (gameBeforeSave.currentLeaderIndex >= gameBeforeSave.playerIDs.length) { gameBeforeSave.currentLeaderIndex = 0; }
  const round = new Round();
  round.currentLeaderID = gameBeforeSave.playerIDs[gameBeforeSave.currentLeaderIndex];
  for (let i = 0; i < gameBeforeSave.playerIDs.length; i += 1) {
    round.voteByPlayerIndex.push('TBD');
  }
  return round.save()
    .then((savedNewRound) => {
      roundAfterSave = savedNewRound;
      return Mission.findById(gameBeforeSave.missions[gameBeforeSave.currentMissionIndex]);
    })
    .then((foundCurrentMission) => {
      foundCurrentMission.rounds.push(roundAfterSave._id);
      return foundCurrentMission.save();
    })
    .then((savedCurrentMission) => {
      missionAfterSave = savedCurrentMission;
      gameBeforeSave.currentRoundIndex += 1;
      gameBeforeSave.currentExpectedInGameAction = 'proposeTeam';
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
// (exported for use in postgame_controller.js)
export const updateWaitingFor = (playerID, foundGame) => {
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

// returns the `gameHistoryObject` in the exact format as specified in the procotol
const composeGameHistoryObject = (savedGame) => {
  const gameHistoryObject = { missions: [] };
  return savedGame.populate({
    path: 'missions',
    populate: { path: 'rounds' },
  }).execPopulate()
    .then((populatedGame) => {
      // for each mission, make a `missionObject` and add it to `gameHistoryObject.missions`
      for (let i = 0; i < populatedGame.missions.length; i += 1) {
        const populatedMission = populatedGame.missions[i];
        const missionVoteComposition = {};
        // for each valid vote, add the playerID: voteType entry to missionVoteComposition
        for (let j = 0; j < populatedMission.missionTeam.length; j += 1) {
          const voter = populatedMission.missionTeam[j];
          missionVoteComposition[voter] = populatedMission.voteByPlayerIndex[populatedGame.playerIDs.indexOf(voter)];
          // alternatively, we can do it the way we do roundVoteComposition:
          // const voteType = populatedMission.voteByPlayerIndex[j];
          // if (voteType === 'SUCCEED' || voteType === 'FAIL') {
          //   // the conditions are to avoid recording placeholders (currently 'TBD')
          //   missionVoteComposition[populatedGame.playerIDs[j]] = voteType;
          // }
        }

        const missionObject = {
          missionOutcome: populatedMission.missionOutcome,
          missionVoteComposition,
          rounds: [],
        };

        // for each round, make a `roundObject` and add it to `missionObject.rounds`
        for (let k = 0; k < populatedMission.rounds.length; k += 1) {
          const populatedRound = populatedMission.rounds[k];

          // for each vote, add the playerID: voteType entry to missionVoteComposition
          const roundVoteComposition = {};
          for (let l = 0; l < populatedRound.voteByPlayerIndex.length; l += 1) {
            roundVoteComposition[populatedGame.playerIDs[l]] = populatedRound.voteByPlayerIndex[l];
          }

          const roundObject = {
            roundOutcome: populatedRound.roundOutcome,
            roundVoteComposition,
            roundLeader: populatedRound.currentLeaderID,
            proposedTeam: populatedRound.proposedTeam,
          };

          missionObject.rounds.push(roundObject);
        }
        gameHistoryObject.missions.push(missionObject);
      }
      return gameHistoryObject;
    })
    .catch((error) => { throw error; });
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
      if (foundGame === null) {
        throw new Error('HOW?? You are a player but you are not associated with any game... what have you done?????');
      }
      if (foundGame.currentExpectedInGameAction !== 'factionViewed') {
        throw new Error('You must have bypassed the front-end to try announcing that you viewed faction without being asked to... Nice try.');
      }
      numCurrentlyWaiting = updateWaitingFor(annoucingPlayer.playerID, foundGame);
      if (numCurrentlyWaiting === null) {
        throw new Error('You must have bypassed the front-end to try announcing that you viewed faction after already annoucing once... Nice try.');
      }
      foundGame.missions = [];
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

// VERY similar to proposeTeam()... all the sanity-checking.
export const cardClicked = (fields, socketID) => {
  let announcingPlayer;
  return Player.findOne({ socketID })
    .then((foundPlayer) => {
      if (foundPlayer === null) {
        throw new Error('You must have bypassed the front-end to try announcing that you clicked on a card without being a player... Nice try.');
      }
      announcingPlayer = foundPlayer;
      return Game.findOne({ sessionID: foundPlayer.sessionID });
    })
    .then((foundGame) => {
      if (foundGame === null) {
        throw new Error('HOW?? You are a player but you are not associated with any game... what have you done?????');
      }
      if (foundGame.currentExpectedInGameAction !== 'proposeTeam' // note the cleverness here... may be a little dangerous
        || foundGame.playerIDs[foundGame.currentLeaderIndex] !== announcingPlayer.playerID) {
        throw new Error('You must have bypassed the front-end to try announcing that you clicked on a card without being asked to... Nice try.');
      }

      if (!foundGame.playerIDs.includes(fields.cardPlayerID)) {
        throw new Error('You must have bypassed the front-end to try announcing that you clicked on the card of some made-up players... Nice try.');
      }

      return {
        action: 'cardClicked',
        sessionID: foundGame.sessionID,
        cardPlayerID: fields.cardPlayerID,
      };
    })
    .catch((error) => { throw error; });
};

export const proposeTeam = (fields, socketID) => {
  let proposingPlayer;
  let gameBeforeSave;
  let roundAfterSave;
  return Player.findOne({ socketID })
    .then((foundPlayer) => {
      if (foundPlayer === null) {
        throw new Error('You must have bypassed the front-end to try proposing a team without being a player... Nice try.');
      }
      proposingPlayer = foundPlayer;
      return Game.findOne({ sessionID: foundPlayer.sessionID });
    })
    .then((foundGame) => {
      if (foundGame === null) {
        throw new Error('HOW?? You are a player but you are not associated with any game... what have you done?????');
      }
      if (foundGame.currentExpectedInGameAction !== 'proposeTeam'
        || foundGame.playerIDs[foundGame.currentLeaderIndex] !== proposingPlayer.playerID) {
        throw new Error('You must have bypassed the front-end to try proposing a team without being asked to... Nice try.');
      }

      for (let i = 0; i < fields.proposedTeam.length; i += 1) {
        if (!foundGame.playerIDs.includes(fields.proposedTeam[i])) {
          throw new Error('You must have bypassed the front-end to try proposing a team with some made-up players... Nice try.');
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
  let gameBeforeSave;
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
      if (foundGame === null) {
        throw new Error('HOW?? You are a player but you are not associated with any game... what have you done?????');
      }
      if (foundGame.currentExpectedInGameAction !== 'voteOnTeamProposal') {
        throw new Error('You must have bypassed the front-end to try voting on team proposal without being asked to... Nice try.');
      }
      numCurrentlyWaiting = updateWaitingFor(votingPlayer.playerID, foundGame);
      if (numCurrentlyWaiting === null) {
        throw new Error('You must have bypassed the front-end to try voting on team proposal after already voting once... Nice try.');
      }
      gameBeforeSave = foundGame;

      return Mission.findById(foundGame.missions[foundGame.currentMissionIndex]);
    })
    .then((foundCurrentMission) => {
      return Round.findById(foundCurrentMission.rounds[gameBeforeSave.currentRoundIndex]);
    })
    .then((foundCurrentRound) => {
      // https://stackoverflow.com/questions/24618584/mongoose-save-not-updating-value-in-an-array-in-database-document
      // BAD ATTEMPT: foundCurrentRound.voteByPlayerIndex[gameBeforeSave.playerIDs.indexOf(votingPlayer.playerID)] = fields.voteType;
      foundCurrentRound.voteByPlayerIndex.set(gameBeforeSave.playerIDs.indexOf(votingPlayer.playerID), fields.voteType);
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
        // still waiting on someone... should emit 'waitingFor'
        return gameBeforeSave.save()
          .then((savedGame) => {
            return {
              action: 'waitingFor',
              sessionID: savedGame.sessionID,
              waitingFor: savedGame.waitingFor,
            };
          })
          .catch((error) => { throw error; });
      } else {
        // not waiting on anyone anymore, should emit 'roundVotes'.
        // compose the voteComposition
        const voteComposition = {};
        for (let i = 0; i < savedCurrentRound.voteByPlayerIndex.length; i += 1) {
          voteComposition[gameBeforeSave.playerIDs[i]] = savedCurrentRound.voteByPlayerIndex[i];
        }

        // check for if the game should end
        // TODO: no magic numbers
        if (gameBeforeSave.currentRoundIndex >= 4 && savedCurrentRound.roundOutcome === 'REJECTED') {
          // if the game should end
          gameBeforeSave.victoriousFaction = 'SPY';
          gameBeforeSave.currentExpectedInGameAction = 'finishViewingGameHistory';
          return gameBeforeSave.save()
            .then((savedGame) => {
              return composeGameHistoryObject(savedGame)
                .then((gameHistoryObject) => {
                  return {
                    action: 'roundVotes',
                    sessionID: savedGame.sessionID,
                    waitingFor: [],

                    voteComposition,
                    roundOutcome: savedCurrentRound.roundOutcome,
                    concludedRound: savedGame.currentRoundIndex + 1,

                    victoriousFaction: 'SPY',
                    spies: savedGame.spies,
                    gameHistory: gameHistoryObject,
                  };
                })
                .catch((error) => { throw error; });
            })
            .catch((error) => { throw error; });
        } else {
          // if the game should not end
          gameBeforeSave.currentExpectedInGameAction = 'votesViewed';
          return gameBeforeSave.save()
            .then((savedGame) => {
              return {
                action: 'roundVotes',
                sessionID: savedGame.sessionID,
                waitingFor: [],

                voteComposition,
                roundOutcome: savedCurrentRound.roundOutcome,
                concludedRound: savedGame.currentRoundIndex + 1,
              };
            })
            .catch((error) => { throw error; });
        }
      }
    })
    .catch((error) => { throw error; });
};

export const votesViewed = (socketID) => {
  let annoucingPlayer;
  let numCurrentlyWaiting;
  let missionBeforeSave;
  let gameBeforeSave;
  return Player.findOne({ socketID })
    .then((foundPlayer) => {
      if (foundPlayer === null) {
        throw new Error('You must have bypassed the front-end to try announcing that you viewed votes without being a player... Nice try.');
      }
      annoucingPlayer = foundPlayer;
      return Game.findOne({ sessionID: foundPlayer.sessionID });
    })
    .then((foundGame) => {
      if (foundGame === null) {
        throw new Error('HOW?? You are a player but you are not associated with any game... what have you done?????');
      }
      if (foundGame.currentExpectedInGameAction !== 'votesViewed') {
        throw new Error('You must have bypassed the front-end to try announcing that you viewed votes without being asked to... Nice try.');
      }
      numCurrentlyWaiting = updateWaitingFor(annoucingPlayer.playerID, foundGame);
      if (numCurrentlyWaiting === null) {
        throw new Error('You must have bypassed the front-end to try announcing that you viewed votes after already annoucing once... Nice try.');
      }

      gameBeforeSave = foundGame;
      return Mission.findById(foundGame.missions[foundGame.currentMissionIndex]);
    })
    .then((foundCurrentMission) => {
      missionBeforeSave = foundCurrentMission;
      return Round.findById(foundCurrentMission.rounds[gameBeforeSave.currentRoundIndex]);
    })
    .then((foundCurrentRound) => {
      if (numCurrentlyWaiting === 0) {
        if (foundCurrentRound.roundOutcome === 'REJECTED') {
          // current proposal was rejected; go into another round of the current mission (if we reach here, it is not
          // the 5th proposal that was rejected, because otherwise the game would have ended at `voteOnTeamProposal()`)
          return newRound(gameBeforeSave)
            .then((newRoundInfo) => {
              return {
                action: 'teamSelectionStarting',
                sessionID: newRoundInfo.sessionID,
                waitingFor: [],
                currentLeaderID: newRoundInfo.currentLeaderID,
                currentMission: newRoundInfo.currentMissionIndex + 1,
                currentRound: newRoundInfo.currentRoundIndex + 1,
                missionSize: newRoundInfo.missionSize,
              };
            })
            .catch((error) => { throw error; });
        } else {
          // current proposal was approved; go into the current mission
          // slice(0) may not be necessary...
          missionBeforeSave.missionTeam = foundCurrentRound.proposedTeam.slice(0);
          return missionBeforeSave.save()
            .then((savedMission) => {
              // manually set the waitingFor correctly, because otherwise it was auto-refilled to be all players
              gameBeforeSave.waitingFor = savedMission.missionTeam;
              gameBeforeSave.currentExpectedInGameAction = 'voteOnMissionOutcome';
              return gameBeforeSave.save();
            })
            .then((savedGame) => {
              return {
                action: 'missionStarting',
                sessionID: savedGame.sessionID,
                waitingFor: [],
                playersOnMission: foundCurrentRound.proposedTeam, // ideally, this should be savedMission.missionTeam...
              };
            })
            .catch((error) => { throw error; });
        }
      } else {
        // still waiting for some players
        return gameBeforeSave.save()
          .then((savedGame) => {
            return {
              action: 'waitingFor',
              sessionID: savedGame.sessionID,
              waitingFor: savedGame.waitingFor,
            };
          })
          .catch((error) => { throw error; });
      }
    })
    .catch((error) => { throw error; });
};

export const voteOnMissionOutcome = (fields, socketID) => {
  let votingPlayer;
  let numCurrentlyWaiting;
  let gameBeforeSave;
  let numFailVotes = 0;
  let missionOutcome = 'SUCCEEDED'; // the default; may be changed to 'FAILED' down below
  if (fields.voteType !== 'SUCCEED' && fields.voteType !== 'FAIL') {
    return new Promise((resolve, reject) => {
      reject(new Error('You must have bypassed the front-end to try sending a bad vote for mission outcome... Nice try.'));
    });
  }

  return Player.findOne({ socketID })
    .then((foundPlayer) => {
      if (foundPlayer === null) {
        throw new Error('You must have bypassed the front-end to try voting on mission outcome without being a player... Nice try.');
      }
      votingPlayer = foundPlayer;
      return Game.findOne({ sessionID: foundPlayer.sessionID });
    })
    .then((foundGame) => {
      if (foundGame === null) {
        throw new Error('HOW?? You are a player but you are not associated with any game... what have you done?????');
      }
      if (foundGame.currentExpectedInGameAction !== 'voteOnMissionOutcome') {
        throw new Error('You must have bypassed the front-end to try voting on mission outcome without being asked to... Nice try.');
      }
      numCurrentlyWaiting = updateWaitingFor(votingPlayer.playerID, foundGame);
      if (numCurrentlyWaiting === null) {
        throw new Error('You must have bypassed the front-end to try voting on mission outcome after already voting once... Nice try.');
      }

      gameBeforeSave = foundGame;

      return Mission.findById(foundGame.missions[foundGame.currentMissionIndex]);
    })
    .then((foundCurrentMission) => {
      foundCurrentMission.voteByPlayerIndex.set(gameBeforeSave.playerIDs.indexOf(votingPlayer.playerID), fields.voteType);
      if (numCurrentlyWaiting === 0) {
        // all votes are cast; check if the missionOutcome should be 'SUCCEEDED' or 'FAILED'
        for (let i = 0; i < foundCurrentMission.voteByPlayerIndex.length; i += 1) {
          // Possibly dangerous: the array should still have 'TBD' in them... thought right now counting 'FAIL' is enough.
          if (foundCurrentMission.voteByPlayerIndex[i] === 'FAIL') {
            numFailVotes += 1;
          }
        }
        if (numFailVotes > 0) {
          missionOutcome = 'FAILED'; // by default it is 'SUCCEEDED', which is declared up top
        }

        foundCurrentMission.missionOutcome = missionOutcome;
      }
      return foundCurrentMission.save();
    })
    .then((savedCurrentMission) => {
      if (numCurrentlyWaiting === 0) {
        // go into the first round of the next mission or make the game end
        // first check if the game should end
        return gameBeforeSave.populate('missions', 'missionOutcome').execPopulate()
          .then((gameWithPopulatedMissions) => {
            let numFailedMissions = 0;
            let numSucceededMissions = 0;
            for (let i = 0; i < gameWithPopulatedMissions.missions.length; i += 1) {
              if (gameWithPopulatedMissions.missions[i].missionOutcome === 'SUCCEEDED') {
                numSucceededMissions += 1;
              } else {
                numFailedMissions += 1;
              }
            }
            let victoriousFaction = null;
            if (numFailedMissions >= 3) {
              victoriousFaction = 'SPY';
            } else if (numSucceededMissions >= 3) {
              victoriousFaction = 'RESISTANCE';
            }

            if (victoriousFaction !== null) {
              // the game SHOULD end
              gameBeforeSave.victoriousFaction = victoriousFaction;
              gameBeforeSave.currentExpectedInGameAction = 'finishViewingGameHistory';
              return gameBeforeSave.save()
                .then((savedGame) => {
                  return composeGameHistoryObject(savedGame);
                })
                .then((gameHistoryObject) => {
                  return {
                    action: 'missionVotes',
                    sessionID: gameBeforeSave.sessionID,
                    waitingFor: [],
                    numFailVotes,
                    missionOutcome,
                    concludedMission: gameBeforeSave.currentMissionIndex + 1,

                    victoriousFaction,
                    spies: gameBeforeSave.spies,
                    gameHistory: gameHistoryObject,
                  };
                })
                .catch((error) => { throw error; });
            } else {
              // the game SHOULD NOT end; go into the first round of next mission:
              return newMission(gameBeforeSave)
                .then((newMissionInfo) => {
                  return {
                    action: 'missionVotes',
                    sessionID: newMissionInfo.sessionID,
                    waitingFor: [],
                    numFailVotes,
                    missionOutcome,
                    concludedMission: newMissionInfo.currentMissionIndex,
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
      } else {
        // still waiting for some players
        return gameBeforeSave.save()
          .then((savedGame) => {
            return {
              action: 'waitingFor',
              sessionID: savedGame.sessionID,
              waitingFor: savedGame.waitingFor,
            };
          })
          .catch((error) => { throw error; });
      }
    })
    .catch((error) => { throw error; });
};

// special functionality that is its own event (i.e. `chat`, which persists from `lobby` to `postGame`)
export const newChat = (message, socketID) => {
  if (typeof message !== 'string') {
    return new Promise((resolve, reject) => {
      reject(new Error('You must have bypassed the front-end to try sending a jumbled chat message... Nice try.'));
    });
  }
  if (message.length > 255) {
    return new Promise((resolve, reject) => {
      reject(new Error('Each chat message should be no more than 255 characters.'));
    });
  }
  return Player.findOne({ socketID })
    .then((foundPlayer) => {
      if (foundPlayer === null) {
        throw new Error('You must have bypassed the front-end to try sending a chat message without being a player... Nice try.');
      }
      return Game.findOne({ sessionID: foundPlayer.sessionID })
        .then((foundGame) => {
          if (foundGame === null) {
            throw new Error('HOW?? You are a player but you are not associated with any game... what have you done?????');
          }
          foundGame.chatLog.push([foundPlayer.playerID, message]);
          return foundGame.save();
        })
        .then((savedGame) => {
          return {
            sessionID: savedGame.sessionID,
            broadcastMessage: [foundPlayer.playerID, message],
          };
        })
        .catch((error) => { throw error; });
    })
    .catch((error) => { throw error; });
};
