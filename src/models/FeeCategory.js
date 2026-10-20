import mongoose from 'mongoose';

const FeeCategorySchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Fee category name is required'],
      trim: true
    },
    code: {
      type: String,
      trim: true,
      uppercase: true
    },
    defaultAmountKobo: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    applicableLevels: {
      type: [String],
      enum: ['NURSERY', 'PRIMARY', 'JSS', 'SSS', 'ALL'],
      default: ['ALL']
    },
    isCompulsory: {
      type: Boolean,
      default: true
    },
    description: {
      type: String,
      default: ''
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

FeeCategorySchema.index({ schoolId: 1, name: 1 }, { unique: true });

export const FeeCategory = mongoose.model('FeeCategory', FeeCategorySchema);
