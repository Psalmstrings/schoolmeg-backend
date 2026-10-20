import mongoose from 'mongoose';
import { STAFF_STATUS, EMPLOYMENT_TYPES, USER_ROLES } from '../config/constants.js';

const StaffSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true
    },
    staffId: {
      type: String,
      required: [true, 'Staff ID is required'],
      trim: true,
      uppercase: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    fullName: {
      type: String,
      required: [true, 'Staff full name is required'],
      trim: true
    },
    passportPhoto: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' }
    },
    dateOfBirth: {
      type: Date
    },
    gender: {
      type: String,
      enum: ['Male', 'Female']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true
    },
    address: {
      type: String,
      trim: true,
      default: ''
    },
    emergencyContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      relationship: { type: String, default: '' }
    },
    employmentDate: {
      type: Date,
      default: Date.now
    },
    employmentType: {
      type: String,
      enum: Object.values(EMPLOYMENT_TYPES),
      default: EMPLOYMENT_TYPES.FULL_TIME
    },
    department: {
      type: String,
      trim: true,
      default: 'Academic'
    },
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      trim: true,
      default: 'Teacher'
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.CLASS_TEACHER
    },
    assignedClasses: [
      {
        classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
        arm: { type: String, default: 'A' },
        subject: { type: String, default: '' },
        isClassTeacher: { type: Boolean, default: false }
      }
    ],
    qualifications: [
      {
        degree: { type: String, required: true },
        institution: { type: String, default: '' },
        year: { type: Number }
      }
    ],
    status: {
      type: String,
      enum: Object.values(STAFF_STATUS),
      default: STAFF_STATUS.ACTIVE,
      index: true
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

StaffSchema.index({ schoolId: 1, staffId: 1 }, { unique: true });
StaffSchema.index({ schoolId: 1, email: 1 });

export const Staff = mongoose.model('Staff', StaffSchema);
