import mongoose from 'mongoose';

const ClassSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true
    },
    level: {
      type: String,
      enum: ['NURSERY', 'PRIMARY', 'JSS', 'SSS', 'OTHER'],
      default: 'PRIMARY'
    },
    arms: {
      type: [String],
      default: ['A']
    },
    subjects: {
      type: [String],
      default: [
        'Mathematics',
        'English Language',
        'Basic Science',
        'Social Studies',
        'Civic Education',
        'Agricultural Science',
        'ICT'
      ]
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

ClassSchema.index({ schoolId: 1, name: 1 }, { unique: true });

export const Class = mongoose.model('Class', ClassSchema);
