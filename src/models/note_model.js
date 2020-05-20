import mongoose, { Schema } from 'mongoose';

const NoteSchema = new Schema({
  title: String,
  x: Number,
  y: Number,
  zIndex: Number,
  text: String,
}, {
  toObject: { virtuals: true }, // why?
  toJSON: { virtuals: true }, // why?
});

// create model class
const NoteModel = mongoose.model('Note', NoteSchema, 'notes');

export default NoteModel;
