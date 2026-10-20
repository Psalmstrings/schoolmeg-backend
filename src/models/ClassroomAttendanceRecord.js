import mongoose from 'mongoose';
import { CLASSROOM_ATTENDANCE_STATUS } from '../config/constants.js';

const ClassroomAttendanceRecordSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClassroomAttendanceSession',
      required: true,
      index: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(CLASSROOM_ATTENDANCE_STATUS),
      default: CLASSROOM_ATTENDANCE_STATUS.PRESENT,
      index: true
    },
    method: {
      type: String,
      enum: ['QR_SCAN', 'MANUAL'],
      default: 'QR_SCAN'
    },
    scannedAt: {
      type: Date,
      default: Date.now
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    remarks: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate count in the same classroom session
ClassroomAttendanceRecordSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });

export const ClassroomAttendanceRecord = mongoose.model(
  'ClassroomAttendanceRecord',
  ClassroomAttendanceRecordSchema
);
