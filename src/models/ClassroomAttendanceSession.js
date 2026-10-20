import mongoose from 'mongoose';

const ClassroomAttendanceSessionSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
      index: true
    },
    arm: {
      type: String,
      required: true,
      default: 'A'
    },
    subject: {
      type: String,
      default: 'General Roll Call'
    },
    date: {
      type: String,
      required: true,
      index: true
    },
    session: {
      type: String,
      required: true
    },
    term: {
      type: String,
      required: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['OPEN', 'COMPLETED'],
      default: 'OPEN'
    },
    notes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

ClassroomAttendanceSessionSchema.index({
  schoolId: 1,
  classId: 1,
  arm: 1,
  date: 1,
  subject: 1
});

export const ClassroomAttendanceSession = mongoose.model(
  'ClassroomAttendanceSession',
  ClassroomAttendanceSessionSchema
);
