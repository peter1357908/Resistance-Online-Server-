import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import socketio from 'socket.io';
import http from 'http';
import mongoose from 'mongoose';
import throttle from 'lodash.throttle';
import debounce from 'lodash.debounce';

import * as Notes from './controllers/note_controller';

// DB Setup
const config = {
  useNewUrlParser: true, // (node:24427) DeprecationWarning
  useUnifiedTopology: true, // (node:24427) DeprecationWarning
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
  Notes.getNotes().then((result) => {
    socket.emit('notes', result);
  });

  // ==============================================================
  // helper functions
  const pushNotes = () => {
    Notes.getNotes().then((result) => {
      // broadcasts to all sockets including ourselves
      io.sockets.emit('notes', result);
    });
  };

  // group all the self-emissions in a certain interval
  let emitToSelf = (notes) => {
    socket.emit('notes', notes);
  };
  emitToSelf = debounce(emitToSelf, 200);

  // emit to others at most at every certain interval
  let emitToOthers = (notes) => {
    socket.broadcast.emit('notes', notes);
  };
  emitToOthers = throttle(emitToOthers, 25);

  const pushNotesSmoothed = () => {
    Notes.getNotes().then((result) => {
      emitToSelf(result);
      emitToOthers(result);
    });
  };

  // ==============================================================
  // socket events
  socket.on('createNote', (fields) => {
    Notes.createNote(fields).then((result) => {
      pushNotes();
    }).catch((error) => {
      console.log(error);
      socket.emit('error', 'create failed');
    });
  });

  socket.on('updateNote', (id, fields) => {
    Notes.updateNote(id, fields).then(() => {
      if (fields.text) {
        pushNotes();
      } else {
        pushNotesSmoothed();
      }
    });
  });

  socket.on('deleteNote', (id) => {
    Notes.deleteNote(id).then(() => {
      pushNotes();
    });
  });
});