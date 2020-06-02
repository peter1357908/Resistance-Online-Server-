import Game from '../models/game_model';
import Player from '../models/player_model';
import Mission from '../models/mission_model';
import Round from '../models/round_model';
import MissionSizes from '../resources/mission_sizes';

export const createGame = (fields, socketID) => {
  if (fields.sessionID === '' || fields.password === '' || fields.playerID === '') {
    return new Promise((resolve, reject) => {
      resolve({
        playerID: null,
        failMessage: 'all fields must be filled out',
      });
    });
  }
  return Game.findOne({ sessionID: fields.sessionID }).then((foundGame) => {
    // if a game with the same sessionID already exists, fail the creation request
    if (foundGame != null) {
      return {
        playerID: null,
        failMessage: 'the sessionID already exists',
      };
    }
    const player = new Player();
    player.playerID = fields.playerID;
    player.sessionID = fields.sessionID;
    player.socketID = socketID;
    return player.save().then((savedPlayer) => {
      const game = new Game();
      game.sessionID = fields.sessionID;
      game.password = fields.password;
      game.creatorID = savedPlayer.playerID;
      game.players = [savedPlayer._id];
      return game.save().then((savedGame) => {
        return {
          playerID: savedPlayer.playerID,
          creatorID: savedGame.creatorID,
          playerIDs: [savedPlayer.playerID],
        };
      }).catch((error) => { throw error; });
    }).catch((error) => { throw error; });
  }).catch((error) => { throw error; });
};

// TODO: what if join fails in any way
export const joinGame = (fields, socketID) => {
  if (fields.sessionID === '' || fields.password === '' || fields.playerID === '') {
    return new Promise((resolve, reject) => {
      resolve({
        playerID: null,
        failMessage: 'all fields must be filled out',
      });
    });
  }
  return Game.findOne({ sessionID: fields.sessionID }).then((foundGame) => {
    if (foundGame === null) {
      return {
        playerID: null,
        failMessage: 'sessionID is not found',
      };
    }
    if (foundGame.password !== fields.password) {
      return {
        playerID: null,
        failMessage: 'password is incorrect',
      };
    }
    return foundGame.populate('players').execPopulate().then((populatedGame) => {
      const playerIDsBeforeJoin = populatedGame.players.map((playerObject) => {
        return playerObject.playerID;
      });
      if (playerIDsBeforeJoin.includes(fields.playerID)) {
        return {
          playerID: null,
          failMessage: 'playerID already taken in the target session',
        };
      } else {
        const player = new Player();
        player.playerID = fields.playerID;
        player.sessionID = fields.sessionID;
        player.socketID = socketID;
        return player.save().then((savedPlayer) => {
          populatedGame.players.push(savedPlayer._id);
          return populatedGame.save().then((savedGame) => {
            return savedGame.populate('players').execPopulate().then((populatedSavedGame) => {
              const playerIDsAfterJoin = populatedSavedGame.players.map((playerObject) => {
                return playerObject.playerID;
              });
              return {
                playerID: savedPlayer.playerID,
                creatorID: savedGame.creatorID,
                playerIDs: playerIDsAfterJoin,
              };
            }).catch((error) => { throw error; });
          }).catch((error) => { throw error; });
        }).catch((error) => { throw error; });
      }
    }).catch((error) => { throw error; });
  }).catch((error) => { throw error; });
};

// TODO: maybe move the initialization to game_controller?
export const startGame = (socketID) => {
  // create new mission
  // create new round
  // pick one of the players to be the current leader

  // TODO: check if the creator is the one starting the game
  return Player.findOne({ socketID }).then((foundPlayer) => {
    return Game.findOne({ sessionID: foundPlayer.sessionID }).then((foundGame) => {
      // TODO: no magic numbers
      if (foundGame.players.length < 5 || foundGame.players.length > 10) {
        return {
          action: 'fail',
          failMessage: 'Not enough people are in the lobby to start the game', // assuming that they didn't hack to somehow produce more than 10 players
        };
      }
      // TODO: Make sure only creator has access to the start
      // find a random leader; otherwise could have grabbed a random Player reference from foundGame.players, and find a Player
      return Player.findOne({ sessionID: foundGame.sessionID }).then((leader) => {
        const round = new Round();
        round.currentLeaderID = leader.playerID;
        return round.save().then((newRound) => {
          const mission = new Mission();
          [mission.missionSize] = MissionSizes[foundGame.players.length];
          mission.currentRound = newRound;
          mission.rounds = [newRound._id];
          return mission.save().then((newMission) => {
            const playerIDs = foundGame.players.map((playerObject) => {
              return playerObject.playerID;
            });
            return {
              action: 'gameStarted',
              sessionID: foundGame.sessionID,
              currentLeaderID: newRound.currentLeaderID,
              playerIDs,
            };
          }).catch((error) => { throw error; });
        }).catch((error) => { throw error; });
      }).catch((error) => { throw error; });
    }).catch((error) => { throw error; });
  }).catch((error) => { throw error; });
};

export const quitLobby = (socketID) => {
  return Player.findOne({ socketID }).then((foundPlayer) => {
    return Game.findOne({ sessionID: foundPlayer.sessionID }).then((foundGame) => {
      // first delete the player document
      return Player.findByIdAndRemove(foundPlayer._id).then((playerRemovalResult) => {
        // if the quitter is the only player (creator) in the lobby, delete the game entry entirely
        // enhanced security by checking both number of players and the player's identity
        if (foundGame.players.length === 1 && foundPlayer.playerID === foundGame.creatorID) {
          return Game.findByIdAndRemove(foundGame._id).then((gameRemovalResult) => {
            return { playerIDs: null };
          });
        }

        // otherwise, the quitter is not the only player in the lobby; remove the player from the game
        foundGame.players.remove(foundPlayer._id);
        return foundGame.save().then((gameWithouQuitter) => {
          // transfer the creator status if necessary
          if (foundPlayer.playerID === foundGame.creatorID) {
            Player.findById(foundGame.players[0]).then((foundNewCreator) => {
              foundGame.creatorID = foundNewCreator.playerID;
            }).catch((error) => {
              throw error;
            });
          }
          return gameWithouQuitter.populate('players').execPopulate().then((populatedGame) => {
            const playerIDs = populatedGame.players.map((playerObject) => {
              return playerObject.playerID;
            });
            return {
              playerIDs, // for constructing the message back to client
              creatorID: foundGame.creatorID, // for constructing the message back to client
              sessionID: foundPlayer.sessionID, // for removing the client from the room they were in
            };
          }).catch((error) => {
            throw error;
          });
        }).catch((error) => { throw error; });
      }).catch((error) => { throw error; });
    }).catch((error) => { throw error; });
  }).catch((error) => { throw error; });
};
