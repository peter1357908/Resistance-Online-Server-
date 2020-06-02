import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import socketio from 'socket.io';
import http from 'http';
import mongoose from 'mongoose';

import * as Pregame from './controllers/pregame_controller';

// DB Setup
const config = {
  useNewUrlParser: true, // (node:24427) DeprecationWarning
  useUnifiedTopology: true, // (node:24427) DeprecationWarning
  useFindAndModify: false, // (node:66361) DeprecationWarning
};
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost/COSC52OnlineMultiplayerGame';
mongoose.connect(mongoURI, config);
// set mongoose promises to es6 default
mongoose.Promise = global.Promise;

// initialize
const app = express();
const server = http.createServer(app);
const io = socketio(server);

// enable/disable cross origin resource sharing if necessary
app.use(cors());

// enable/disable http request logging
app.use(morgan('dev'));

// enable only if you want templating
app.set('view engine', 'ejs');

// enable only if you want static assets from folder static
app.use(express.static('static'));

// this just allows us to render ejs from the ../app/views directory
app.set('views', path.join(__dirname, '../src/views'));

// enable json message body for posting data to API
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// additional init stuff should go before hitting the routing

// default index route
app.get('/', (req, res) => {
  res.send('hi');
});

// START THE SERVER
// =============================================================================
const port = process.env.PORT || 9090;
server.listen(port);

console.log(`listening on: ${port}`);

io.on('connection', (socket) => {
  // ==============================================================
  // upon first connection, do...

  // ==============================================================
  // helper functions

  // ==============================================================
  // socket events

  socket.on('createGame', (fields) => {
    Pregame.createGame(fields, socket.id).then((result) => {
      socket.join(fields.sessionID);
      io.to(socket.id).emit('createGame', { playerID: result.playerID });
      io.to(fields.sessionID).emit('lobby', {
        action: 'someoneJoined',
        creatorID: result.creatorID,
        playerIDs: result.playerIDs,
      }); // equivalent to io.to(socket.id) HERE
    }).catch((error) => {
      // TODO: the emission is for fail, NOT error... but for now...
      console.log(error);
      io.to(socket.id).emit('createGame', { playerID: null, failMessage: error });
    });
  });

  // TODO: handle errors
  socket.on('joinGame', (fields) => {
    Pregame.joinGame(fields, socket.id).then((result) => {
      if (result.playerID === null) {
        io.to(socket.id).emit('joinGame', {
          playerID: null,
          failMessage: 'playerID already taken in the target session',
        });
      } else {
        socket.join(fields.sessionID);
        io.to(socket.id).emit('joinGame', { playerID: result.playerID });
        io.to(fields.sessionID).emit('lobby', {
          action: 'someoneJoined',
          creatorID: result.creatorID,
          playerIDs: result.playerIDs,
        });
      }
    }).catch((error) => {
      console.log(error);
      io.to(socket.id).emit('joinGame', { playerID: null, failMessage: error });
    });
  });

  socket.on('lobby', (fields) => {
    switch (fields.action) {
      case 'quitLobby':
        Pregame.quitLobby(socket.id).then((result) => {
          io.to(socket.id).emit('lobby', { action: 'quitAcknowledged' });
          socket.leave(result.sessionID);
          io.to(fields.sessionID).emit('lobby', {
            action: 'someoneQuit',
            playerIDs: result.playerIDs,
            creatorID: result.creatorID,
          });
        });
        break;
      case 'startGame':
        Pregame.startGame(socket.id).then((result) => {
          if (result.playerIDs === null) {
            io.to(socket.id).emit('lobby', {
              action: 'fail',
              failMessage: 'do not start a game until right number of players are in the lobby',
            });
          } else {
            io.to(result.sessionID).emit('lobby', {
              action: 'gameStarted',
            });
            io.to(result.sessionID).emit('inGame', {
              currentLeaderID: result.currentLeaderID,
              playerIDs: result.playerIDs,
            });
          }
        });
        break;
      default:
        console.log(`unknown action: ${fields.action}`);
        break;
    }
  });

  // socket.on('inGame')...
  // socket.on('postGame')...
});
