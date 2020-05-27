import Game from '../models/game_model';
import Player from '../models/player_model';

// fields will have: playerID, sessionID, sessionPassword
// TODO: what if creation fails in any way
export const createGame = (fields, socketID) => {
  const player = new Player();
  player.playerID = fields.playerID;
  player.sessionID = fields.sessionID;
  player.socketID = socketID;
  return player.save()
    .then((savedPlayer) => {
      const game = new Game();
      game.sessionID = fields.sessionID;
      game.password = fields.password;
      game.creator = savedPlayer._id;
      game.players = [];
      game.players.push(savedPlayer._id);
      return game.save()
        .then((savedGame) => {
          const playerIDs = [];
          playerIDs.push(fields.playerID);
          return {
            currentLeader: -1,
            playerIDs,
          };
        })
        .catch((error) => {
          throw error;
        });
    })
    .catch((error) => {
      throw error;
    });
};

// TODO: what if join fails in any way
export const joinGame = (fields, socketID) => {
  const player = new Player();
  player.playerID = fields.playerID;
  player.sessionID = fields.sessionID;
  player.socketID = socketID;
  return player.save()
    .then((savedPlayer) => {
      return Game.findOne({ sessionID: fields.sessionID })
        .then((foundGame) => {
          // TODO: what if no game found?
          foundGame.players.push(savedPlayer._id);
          return foundGame.save()
            .then((savedGame) => {
              // TODO: very convoluted workaround on populate; find a better way!
              return savedGame.populate('players').execPopulate()
                .then((populatedGame) => {
                  return {
                    currentLeader: -1,
                    playerIDs: populatedGame.players.map((playerObject) => {
                      return playerObject.playerID;
                    }),
                  };
                })
                .catch((error) => {
                  throw error;
                });
            })
            .catch((error) => {
              throw error;
            });
        })
        .catch((error) => {
          throw error;
        });
    })
    .catch((error) => {
      throw error;
    });
};
