import mongoose from 'mongoose';

const CounterSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  key: {
    type: String,
    required: true,
    trim: true
  },
  seq: {
    type: Number,
    default: 0
  }
});

CounterSchema.index({ schoolId: 1, key: 1 }, { unique: true });

export const Counter = mongoose.model('Counter', CounterSchema);
