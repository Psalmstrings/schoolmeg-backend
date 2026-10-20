import mongoose from 'mongoose';
import { STUDENT_STATUS } from '../config/constants.js';

const StudentSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true
    },
    admissionNumber: {
      type: String,
      required: [true, 'Admission number is required'],
      trim: true,
      uppercase: true
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true
    },
    middleName: {
      type: String,
      trim: true,
      default: ''
    },
    surname: {
      type: String,
      required: [true, 'Surname is required'],
      trim: true
    },
    preferredName: {
      type: String,
      trim: true,
      default: ''
    },
    passportPhoto: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' }
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required']
    },
    gender: {
      type: String,
      enum: ['Male', 'Female'],
      required: [true, 'Gender is required']
    },
    nationality: {
      type: String,
      default: 'Nigerian'
    },
    stateOfOrigin: {
      type: String,
      default: ''
    },
    lga: {
      type: String,
      default: ''
    },
    homeAddress: {
      type: String,
      required: [true, 'Home address is required'],
      trim: true
    },
    admissionDate: {
      type: Date,
      default: Date.now
    },
    admissionSession: {
      type: String,
      required: [true, 'Admission session is required']
    },
    currentClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Current class is required'],
      index: true
    },
    currentArm: {
      type: String,
      required: [true, 'Class arm is required'],
      default: 'A'
    },
    status: {
      type: String,
      enum: Object.values(STUDENT_STATUS),
      default: STUDENT_STATUS.ACTIVE,
      index: true
    },
    previousSchool: {
      type: String,
      default: ''
    },
    medicalInfo: {
      bloodGroup: { type: String, default: '' },
      genotype: { type: String, default: '' },
      allergies: { type: String, default: '' },
      emergencyMedicalNotes: { type: String, default: '' }
    },
    primaryGuardian: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guardian',
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

// Virtual for full name
StudentSchema.virtual('fullName').get(function () {
  return `${this.surname} ${this.firstName} ${this.middleName}`.replace(/\s+/g, ' ').trim();
});

StudentSchema.set('toJSON', { virtuals: true });
StudentSchema.set('toObject', { virtuals: true });

// Compound unique index per school
StudentSchema.index({ schoolId: 1, admissionNumber: 1 }, { unique: true });
StudentSchema.index({ schoolId: 1, currentClass: 1, currentArm: 1, status: 1 });

export const Student = mongoose.model('Student', StudentSchema);
