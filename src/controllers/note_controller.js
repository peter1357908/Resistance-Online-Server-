import Note from '../models/note_model';

export const createNote = (fields) => {
  const note = new Note();

  Object.keys(fields).forEach((k) => {
    note[k] = fields[k];
  });

  return note.save();
};

export const getNotes = () => {
  return Note.find({}).then((notes) => {
    return notes.reduce((result, item) => {
      result[item.id] = item;
      return result;
    }, {});
  });
};

export const deleteNote = (id) => {
  return Note.findOneAndDelete({ _id: id });
};

export const updateNote = (id, fields) => {
  return Note.findById(id)
    .then((note) => {
      Object.keys(fields).forEach((k) => {
        note[k] = fields[k];
      });
      return note.save();
    });
};
