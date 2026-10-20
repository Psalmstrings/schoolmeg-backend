import mongoose from 'mongoose';

const SubjectResultSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
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
      trim: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    academicSession: {
      type: String,
      required: true,
      trim: true
    },
    term: {
      type: String,
      enum: ['First Term', 'Second Term', 'Third Term'],
      required: true
    },
    caScore: {
      type: Number,
      min: 0,
      max: 40,
      default: 0
    },
    examScore: {
      type: Number,
      min: 0,
      max: 60,
      default: 0
    },
    totalScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    grade: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'E', 'F'],
      default: 'F'
    },
    remark: {
      type: String,
      default: 'Fail'
    },
    teacherRemarks: {
      type: String,
      default: ''
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED'],
      default: 'DRAFT',
      index: true
    },
    submittedAt: {
      type: Date,
      default: null
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

SubjectResultSchema.index(
  { schoolId: 1, studentId: 1, classId: 1, arm: 1, subject: 1, academicSession: 1, term: 1 },
  { unique: true }
);

export const SubjectResult = mongoose.model('SubjectResult', SubjectResultSchema);
