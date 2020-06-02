import Game from '../models/game_model';
import Player from '../models/player_model';
import Mission from '../models/mission_model';
import Round from '../models/round_model';
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
      return {
        playerID: savedPlayer.playerID,
        creatorID: savedGame.creatorID,
        playerIDs: [savedPlayer.playerID],
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
  return Game.findOne({ sessionID: fields.sessionID }).then((foundGame) => {
    // TODO: what if no game found?
    return foundGame.populate('players').execPopulate().then((populatedGame) => {
      const playerIDsBeforeJoin = populatedGame.players.map((playerObject) => {
        return playerObject.playerID;
      });
      if (playerIDsBeforeJoin.includes(fields.playerID)) {
        return { playerID: null };
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
            }).catch((error) => {
              throw error;
            });
          }).catch((error) => {
            throw error;
          });
        }).catch((error) => {
          throw error;
        });
      }
    }).catch((error) => {
      throw error;
    });
  }).catch((error) => {
    throw error;
  });
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
        return { playerIDs: null };
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
              sessionID: foundGame.sessionID,
              currentLeaderID: newRound.currentLeaderID,
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
  }).catch((error) => {
    throw error;
  });
};

export const quitLobby = (socketID) => {
  return Player.findOne({ socketID }).then((foundPlayer) => {
    return Game.findOne({ sessionID: foundPlayer.sessionID }).then((foundGame) => {
      foundGame.players.remove(foundPlayer._id);
      if (foundGame.players.length === 1) {
        // the quitter is the only player in the lobby; delete the game entry entirely
        Game.findByIdAndRemove(foundGame._id);
      } else {
        // the quitter is not the only player in the lobby; transfer the creator status if necessary
        if (foundPlayer.playerID === foundGame.creatorID) {
          Player.findById(foundGame.players[0]).then((foundNewCreator) => {
            foundGame.creatorID = foundNewCreator.playerID;
          }).catch((error) => {
            throw error;
          });
        }
        // and remove the reference to the player in the game
        foundGame.players.remove(foundPlayer._id);
      }

      return Player.findByIdAndRemove(foundPlayer._id).then((removalResult) => {
        return foundGame.populate('players').execPopulate().then((populatedGame) => {
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
