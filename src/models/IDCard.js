import mongoose from 'mongoose';
import crypto from 'crypto';
import { ID_CARD_STATUS } from '../config/constants.js';

const IDCardSchema = new mongoose.Schema(
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
    cardNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    // Opaque cryptographic token embedded in QR code
    qrCodeString: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(ID_CARD_STATUS),
      default: ID_CARD_STATUS.ACTIVE,
      index: true
    },
    issueDate: {
      type: Date,
      default: Date.now
    },
    expiryDate: {
      type: Date
    },
    reissueCount: {
      type: Number,
      default: 0
    },
    revokedAt: {
      type: Date,
      default: null
    },
    revocationReason: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

IDCardSchema.index({ schoolId: 1, holderType: 1, status: 1 });
IDCardSchema.index({ schoolId: 1, cardNumber: 1 }, { unique: true });

export const IDCard = mongoose.model('IDCard', IDCardSchema);
