import Game from '../models/game_model';

export const createGame = (fields) => {
  const game = new Game(fields);
  game.numPlayers = 1;
  return game.save();
};

export const joinGame = (fields) => {
  return Game.findOne({ sessionID: fields.sessionID })
    .then((foundGame) => {
      foundGame.playerIDs.push(fields.playerID);
      foundGame.numPlayers += 1;
      return foundGame.save();
    })
    .catch((error) => {
      throw error;
    });
};
