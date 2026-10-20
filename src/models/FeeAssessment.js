import mongoose from 'mongoose';

const FeeAssessmentSchema = new mongoose.Schema(
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
      required: true
    },
    academicSession: {
      type: String,
      required: true
    },
    term: {
      type: String,
      enum: ['First Term', 'Second Term', 'Third Term'],
      required: true
    },
    items: [
      {
        name: { type: String, required: true },
        amountKobo: { type: Number, required: true, min: 0 }
      }
    ],
    totalAmountKobo: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    discountKobo: {
      type: Number,
      min: 0,
      default: 0
    },
    netAmountKobo: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    paidAmountKobo: {
      type: Number,
      min: 0,
      default: 0
    },
    balanceKobo: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['UNPAID', 'PARTIAL', 'PAID', 'OVERPAID'],
      default: 'UNPAID',
      index: true
    },
    dueDate: {
      type: Date,
      default: null
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

FeeAssessmentSchema.index(
  { schoolId: 1, studentId: 1, academicSession: 1, term: 1 },
  { unique: true }
);

export const FeeAssessment = mongoose.model('FeeAssessment', FeeAssessmentSchema);
