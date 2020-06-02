import Game from '../models/game_model';
import Player from '../models/player_model';
import Mission from './models/mission';
import Round from './models/round';
import MissionSizes from '../resources/mission_sizes';

// fields will have: playerID, sessionID, sessionPassword
// TODO: what if creation fails in any way
export const createGame = (fields, socketID) => {
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
      const playerIDs = [fields.playerID];
      const creatorID = savedGame.creatorID;
      return {
        currentLeader: -1,
        creatorID,
        playerIDs,
      };
    }).catch((error) => {
      throw error;
    });
  }).catch((error) => {
    throw error;
  });
};

// TODO: what if join fails in any way
export const joinGame = (fields, socketID) => {
  // disallow joining the game with an ID belonging to another player in the same room
  const player = new Player();
  player.playerID = fields.playerID;
  player.sessionID = fields.sessionID;
  player.socketID = socketID;
  return player.save().then((savedPlayer) => {
    return Game.findOne({ sessionID: fields.sessionID }).then((foundGame) => {
      // TODO: what if no game found?
      foundGame.players.push(savedPlayer._id);
      return foundGame.save().then((savedGame) => {
        // TODO: very convoluted workaround on populate; find a better way!
        return savedGame.populate('players').execPopulate().then((populatedGame) => {
          const playerIDs = populatedGame.players.map((playerObject) => {
            return playerObject.playerID;
          });
          return {
            currentLeader: -1,
            creatorID: populatedGame.creatorID,
            playerIDs,
          };
        }).catch((error) => {
          throw error;
        });
      }).catch((error) => {
        throw error;
      });
    }).catch((error) => {
      throw error;
    });
  }).catch((error) => {
    throw error;
  });
};

// TODO: maybe move the initialization to game_controller?
export const startGame = (fields, socketID) => {
  // create new mission
  // create new round
  // pick one of the players to be the current leader
  return Game.findOne({ sessionID: fields.sessionID }).then((foundGame) => {
    return Player.findOne({ sessionID: foundGame.sessionID }).then((leader) => {
      const round = new Round();
      round.currentLeaderID = leader.playerID;
      return round.save().then((newRound) => {
        const mission = new Mission();
        const numPlayers = foundGame.players.length;
        mission.missionSize = MissionSizes[numPlayers][0]; // 5:[2,3,4,5,5]
        mission.currentRound = newRound;
        mission.rounds = [newRound._id];
        return mission.save().then((newMission) => {
          return {
            currentLeaderID: newRound.currentLeaderID,
            // playerIDs:,
          }
        }).catch((error) => {
          throw error;
        });
      }).catch((error) => {
        throw error;
      });
    }).catch((error) => {
      throw error;
    });
  }).catch((error) => {
    throw error;
  });
};

export const quitLobby = (socketID) => {
  return Player.findOne({ socketID }).then((foundPlayer) => {
    return Game.findOne({ sessionID: foundPlayer.sessionID }).then((foundGame) => {
      if(foundGame.players.length != 1) {
        return foundGame.players.remove(player._id).then((updatedGame) => {
          return updatedGame.populate('players').execPopulate().then((populatedGame) => {
            Player.remove({  _id: player._id })
            const playerIDs = populatedGame.players.map((playerObject) => {
              return playerObject.playerID;
            });
            return {
              playerIDs, // for constructing the message back to client
              sessionID, // for removing the client from the room they were in
            }
          }).catch((error) => {
            throw error;
          });;
        }).catch((error) => {
          throw error;
        });;
      }
    }).catch((error) => {
      throw error;
    });;
  }).catch((error) => {
    throw error;
  });;
};
