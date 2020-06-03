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
    if (foundGame.inLobby) {
      return {
        playerID: null,
        failMessage: 'the session is not currently accepting new players (the game may have already started)',
      };
    }
    if (foundGame.players.length >= 10) {
      return {
        playerID: null,
        failMessage: 'the session is already full',
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


// Helper function to shuffle an array
function shuffle(array) {
  array.sort(() => { return Math.random() - 0.5; });
}

function shuffle2(array) {
  return array.sort(() => { return Math.random() - 0.5; }).slice(0);
}

// TODO: maybe move the initialization to game_controller?
export const startGame = (socketID) => {
  // console.log("startgame Called");
  return Player.findOne({ socketID }).then((foundPlayer) => {
    return Game.findOne({ sessionID: foundPlayer.sessionID }).then((foundGame) => {
      // TODO: no magic numbers
      const numPlayers = foundGame.players.length;

      if (numPlayers < 5 || numPlayers > 10) {
        return {
          action: 'fail',
          failMessage: 'Not enough people are in the lobby to start the game', // assuming that they didn't hack to somehow produce more than 10 players
        };
      }
      const numSpies = Math.ceil(numPlayers / 3.0);
      const newArray = shuffle2(foundGame.players);
      for (let i = 0; i < numSpies; i += 1) {
        const spyPlayerObjectId = newArray[i];
        Player.findById(spyPlayerObjectId).then((foundSpy) => {
          foundSpy.faction = 'SPY';
          foundSpy.save().then((savedSpy) => {
            foundGame.spies.push(savedSpy);
          }).catch((error) => { throw error; });
        }).catch((error) => { throw error; });
      }
      shuffle(foundGame.players);

      foundGame.inLobby = false;

      return foundGame.save().then((savedGame) => {
        return savedGame.populate('players').execPopulate().then((populatedGame) => {
          return populatedGame.populate('spies').execPopulate().then((populatedSavedGame) => {
            const playerIDs = populatedSavedGame.players.map((playerObject) => {
              return playerObject.playerID;
            });
            const spyIDs = populatedSavedGame.spies.map((playerObject) => {
              return playerObject.playerID;
            });
            const spySockets = populatedSavedGame.spies.map((playerObject) => {
              return playerObject.socketID;
            });
            return {
              action: 'gameStarted',
              sessionID: foundGame.sessionID,
              spies: spyIDs,
              spySockets,
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
