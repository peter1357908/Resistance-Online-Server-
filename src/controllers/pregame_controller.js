import Game from '../models/game_model';
import Player from '../models/player_model';

// --------------------------------------------------------------------------
// Helper Functions
// https://medium.com/@nitinpatel_20236/how-to-shuffle-correctly-shuffle-an-array-in-javascript-15ea3f84bfb
const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * i);
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
};

export const createGame = (fields, socketID) => {
  if (fields.sessionID === '' || fields.password === '' || fields.playerID === '') {
    return new Promise((resolve, reject) => {
      reject(new Error('all fields must be filled out'));
    });
  }
  return Game.findOne({ sessionID: fields.sessionID })
    .then((foundGame) => {
      // if a game with the same sessionID already exists, fail the creation request
      if (foundGame != null) {
        throw new Error('the sessionID already exists');
      }
      const game = new Game();
      game.sessionID = fields.sessionID;
      game.password = fields.password;
      game.creatorID = fields.playerID;
      game.playerIDs = [fields.playerID];
      game.currentMissionIndex = -1;
      game.inLobby = true;
      return game.save();
    })
    .then((savedGame) => {
      const player = new Player();
      player.playerID = fields.playerID;
      player.sessionID = fields.sessionID;
      player.socketID = socketID;
      return player.save();
    })
    .then((savedPlayer) => {
      // assuming that the saved values are the same as the input fields
      return {
        sessionID: fields.sessionID,
        playerID: fields.playerID,
        creatorID: fields.playerID,
        playerIDs: [fields.playerID],
      };
    })
    .catch((error) => { throw error; });
};

export const joinGame = (fields, socketID) => {
  if (fields.sessionID === '' || fields.password === '' || fields.playerID === '') {
    return new Promise((resolve, reject) => {
      reject(new Error('all fields must be filled out'));
    });
  }

  let finalGame;
  return Game.findOne({ sessionID: fields.sessionID })
    .then((foundGame) => {
      let failMessage = null;
      if (foundGame === null) {
        failMessage = 'sessionID is not found';
      } else if (foundGame.password !== fields.password) {
        failMessage = 'password is incorrect';
      } else if (!foundGame.inLobby) {
        failMessage = 'the session is not currently accepting new players (the game may have already started)';
      } else if (foundGame.playerIDs.length >= 10) {
        failMessage = 'the session is already full';
      } else if (foundGame.playerIDs.includes(fields.playerID)) {
        failMessage = 'playerID already taken in the target session';
      }
      if (failMessage !== null) {
        throw new Error(failMessage);
      }
      foundGame.playerIDs.push(fields.playerID);
      return foundGame.save();
    })
    .then((savedGame) => {
      finalGame = savedGame;
      const player = new Player();
      player.playerID = fields.playerID;
      player.sessionID = fields.sessionID;
      player.socketID = socketID;
      return player.save();
    })
    .then((savedPlayer) => {
      return {
        sessionID: savedPlayer.sessionID,
        playerID: savedPlayer.playerID,
        creatorID: finalGame.creatorID,
        playerIDs: finalGame.playerIDs,
        chatLog: finalGame.chatLog,
      };
    })
    .catch((error) => { throw error; });
};

export const startGame = (socketID) => {
  let requestingPlayer;
  const spySocketIDs = [];
  return Player.findOne({ socketID })
    .then((foundPlayer) => {
      if (foundPlayer === null) {
        throw new Error('You tried to start a game without being a player... did you accidentally fresh the page?');
      }
      requestingPlayer = foundPlayer;
      return Game.findOne({ sessionID: foundPlayer.sessionID });
    })
    .then((foundGame) => {
      let failMessage = null;
      const numPlayers = foundGame.playerIDs.length;
      if (foundGame.creatorID !== requestingPlayer.playerID) {
        failMessage = 'You must have bypassed the front-end to try starting a game without being the session\'s creator... Nice try.';
      } else if (!foundGame.inLobby) {
        failMessage = 'You must have bypassed the front-end to try starting a game outside lobby... Nice try.';
      } else if (numPlayers < 5 || numPlayers > 10) {
        // TODO: no magic numbers
        failMessage = 'Not enough people are in the lobby to start the game'; // assuming that they didn't hack to somehow produce more than 10 players
      }
      if (failMessage !== null) {
        throw new Error(failMessage);
      }

      // TODO: no magic formulas
      const numSpies = Math.ceil(numPlayers / 3.0);
      // first shuffle ensures that the spies are not always the first players that joined
      shuffle(foundGame.playerIDs);
      for (let i = 0; i < numSpies; i += 1) {
        const spyPlayerID = foundGame.playerIDs[i];
        Player.findOne({ playerID: spyPlayerID, sessionID: foundGame.sessionID })
          .then((foundSpyPlayer) => { spySocketIDs.push(foundSpyPlayer.socketID); })
          .catch((error) => { throw error; });
        foundGame.spies.push(spyPlayerID);
      }
      // second shuffle ensures that the spies are not always the first players after the first shuffle...
      shuffle(foundGame.playerIDs);

      foundGame.inLobby = false;

      // prepare for the next expected action
      foundGame.waitingFor = foundGame.playerIDs.slice(0);
      foundGame.currentExpectedInGameAction = 'factionViewed';

      return foundGame.save();
    })
    .then(async (savedGame) => {
      return {
        action: 'gameStarted',
        sessionID: savedGame.sessionID,
        spies: savedGame.spies,
        playerIDs: savedGame.playerIDs,
        spySocketIDs: await Promise.all(spySocketIDs),
      };
    })
    .catch((error) => { throw error; });
};

export const quitLobby = (socketID) => {
  return Player.findOne({ socketID })
    .then((quittingPlayer) => {
      if (quittingPlayer === null) {
        // reaching here could mean that the client refreshed the lobby page and clicked quit (the client is not a player yet)
        return { playerIDs: null };
      } else {
        // first delete the player document
        return Player.findByIdAndRemove(quittingPlayer._id)
          .then((playerRemovalResult) => {
            return Game.findOne({ sessionID: quittingPlayer.sessionID });
          })
          .then((foundGame) => {
            if (foundGame.playerIDs.length === 1 && quittingPlayer.playerID === foundGame.creatorID) {
              // if the quitter is the only player (creator) in the lobby, delete the game entry entirely
              // enhanced security by checking both number of players and the player's identity
              return Game.findByIdAndRemove(foundGame._id)
                .then((gameRemovalResult) => { return { playerIDs: null }; })
                .catch((error) => { throw error; });
            } else if (foundGame.playerIDs.length === 1) {
              // impossible situation: the quitter is a player, but not the creator of their session, yet their session has only one player...
              throw new Error('If you are getting this meesage... we made some serious coding mistakes...');
            } else {
              // otherwise, the quitter is not the only player in the lobby; remove the player from the game document
              foundGame.playerIDs.pull(quittingPlayer.playerID);
              return foundGame.save()
                .then((gameWithouQuitter) => {
                  // transfer the creator status if necessary
                  if (quittingPlayer.playerID === gameWithouQuitter.creatorID) {
                    [gameWithouQuitter.creatorID] = gameWithouQuitter.playerIDs;
                    gameWithouQuitter.save().catch((error) => { throw error; });
                  }
                  return {
                    playerIDs: gameWithouQuitter.playerIDs, // for constructing the message back to client
                    creatorID: gameWithouQuitter.creatorID, // for constructing the message back to client
                    sessionID: gameWithouQuitter.sessionID, // for removing the client from the room they were in
                  };
                })
                .catch((error) => { throw error; });
            }
          });
      }
    })
    .catch((error) => { throw error; });
};

// special function that applies to all stages of the game
export const handleDisconnection = (socketID) => {
  return Player.findOne({ socketID })
    .then((disconnectingPlayer) => {
      if (disconnectingPlayer === null) {
        // the disconnecting client is not even a player yet...
        return { playerIDs: null };
      } else {
        return Game.findOne({ sessionID: disconnectingPlayer.sessionID })
          .then((foundGame) => {
            if (foundGame.inLobby) {
              // first delete the player document
              return Player.findByIdAndRemove(disconnectingPlayer._id)
                .then((playerRemovalResult) => {
                  if (foundGame.playerIDs.length === 1 && disconnectingPlayer.playerID === foundGame.creatorID) {
                    // if the quitter is the only player (creator) in the lobby, delete the game entry entirely
                    // enhanced security by checking both number of players and the player's identity
                    return Game.findByIdAndRemove(foundGame._id)
                      .then((gameRemovalResult) => { return { playerIDs: null }; })
                      .catch((error) => { throw error; });
                  } else if (foundGame.playerIDs.length === 1) {
                    // impossible situation: the quitter is a player, but not the creator of their session, yet their session has only one player...
                    throw new Error('We made some serious coding mistakes...');
                  } else {
                    // otherwise, the quitter is not the only player in the lobby; remove the player from the game document
                    foundGame.playerIDs.pull(disconnectingPlayer.playerID);
                    return foundGame.save()
                      .then((gameWithouQuitter) => {
                        // transfer the creator status if necessary
                        if (disconnectingPlayer.playerID === gameWithouQuitter.creatorID) {
                          [gameWithouQuitter.creatorID] = gameWithouQuitter.playerIDs;
                          gameWithouQuitter.save().catch((error) => { throw error; });
                        }
                        return {
                          event: 'lobby', // for determining if the message is for event 'lobby', 'inGame'... or 'postGame'?
                          playerIDs: gameWithouQuitter.playerIDs, // for constructing the message back to client
                          creatorID: gameWithouQuitter.creatorID, // for constructing the message back to client
                          sessionID: gameWithouQuitter.sessionID, // for removing the client from the room they were in
                        };
                      })
                      .catch((error) => { throw error; });
                  }
                })
                .catch((error) => { throw error; });
            } else {
              // TODO!! handle inGame disconnection gracefully... currently nothing is done...
              return { playerIDs: null };
            }
          })
          .catch((error) => { throw error; });
      }
    }).catch((error) => { throw error; });
};
