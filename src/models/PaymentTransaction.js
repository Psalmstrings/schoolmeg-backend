import mongoose from 'mongoose';

const PaymentTransactionSchema = new mongoose.Schema(
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
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeAssessment',
      required: true,
      index: true
    },
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    amountPaidKobo: {
      type: Number,
      required: true,
      min: 1
    },
    paymentMethod: {
      type: String,
      enum: ['BANK_TRANSFER', 'POS', 'CASH', 'CHEQUE', 'ONLINE'],
      required: true,
      default: 'BANK_TRANSFER'
    },
    referenceNumber: {
      type: String,
      default: '',
      trim: true
    },
    paymentDate: {
      type: Date,
      default: Date.now
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
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

PaymentTransactionSchema.index({ schoolId: 1, studentId: 1, paymentDate: -1 });

export const PaymentTransaction = mongoose.model('PaymentTransaction', PaymentTransactionSchema);
