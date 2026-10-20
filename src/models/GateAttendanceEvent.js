import mongoose from 'mongoose';
import { GATE_ATTENDANCE_STATUS } from '../config/constants.js';

const GateAttendanceEventSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true
    },
    holderType: {
      type: String,
      enum: ['STUDENT', 'STAFF'],
      required: true,
      index: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
      index: true
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
      index: true
    },
    idCardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IDCard',
      required: true,
      index: true
    },
    eventType: {
      type: String,
      enum: ['ENTRY', 'EXIT'],
      required: true,
      index: true
    },
    // School date in YYYY-MM-DD
    date: {
      type: String,
      required: true,
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    gateName: {
      type: String,
      default: 'Main Campus Gate'
    },
    isLate: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: Object.values(GATE_ATTENDANCE_STATUS),
      default: GATE_ATTENDANCE_STATUS.PRESENT_ON_CAMPUS
    },
    isManualCorrection: {
      type: Boolean,
      default: false
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

GateAttendanceEventSchema.index({ schoolId: 1, date: 1, studentId: 1, eventType: 1 });
GateAttendanceEventSchema.index({ schoolId: 1, date: 1, staffId: 1, eventType: 1 });

export const GateAttendanceEvent = mongoose.model('GateAttendanceEvent', GateAttendanceEventSchema);
