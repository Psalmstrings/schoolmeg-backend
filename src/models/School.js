import mongoose from 'mongoose';
import { SCHOOL_TYPES, DEFAULT_GRADING_SCALE } from '../config/constants.js';

const SchoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'School name is required'],
      trim: true,
      maxlength: [150, 'School name cannot exceed 150 characters']
    },
    code: {
      type: String,
      required: [true, 'School unique code is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true
    },
    schoolType: {
      type: String,
      enum: Object.values(SCHOOL_TYPES),
      default: SCHOOL_TYPES.COMBINED
    },
    logoUrl: {
      type: String,
      default: ''
    },
    motto: {
      type: String,
      default: 'Knowledge, Integrity and Excellence',
      trim: true
    },
    contact: {
      email: {
        type: String,
        required: [true, 'Official school email is required'],
        trim: true,
        lowercase: true
      },
      phone: {
        type: String,
        required: [true, 'School phone number is required'],
        trim: true
      },
      website: {
        type: String,
        default: ''
      }
    },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      lga: { type: String, default: '' },
      state: { type: String, required: [true, 'State is required'], default: 'Lagos' },
      country: { type: String, default: 'Nigeria' }
    },
    academicSettings: {
      currentSession: {
        type: String,
        default: '2025/2026'
      },
      currentTerm: {
        type: String,
        enum: ['First Term', 'Second Term', 'Third Term'],
        default: 'First Term'
      },
      termStartDate: { type: Date },
      termEndDate: { type: Date }
    },
    attendanceRules: {
      openingTime: { type: String, default: '07:30' },
      closingTime: { type: String, default: '15:30' },
      lateThresholdTime: { type: String, default: '08:15' },
      gateScanningWindows: {
        arrivalStart: { type: String, default: '06:30' },
        arrivalEnd: { type: String, default: '10:00' },
        departureStart: { type: String, default: '13:00' },
        departureEnd: { type: String, default: '18:00' }
      }
    },
    gradingPolicy: {
      scale: {
        type: [
          {
            grade: { type: String, required: true },
            minScore: { type: Number, required: true },
            maxScore: { type: Number, required: true },
            description: { type: String, default: '' },
            gradePoint: { type: Number, default: 0 }
          }
        ],
        default: () => DEFAULT_GRADING_SCALE
      },
      passThreshold: {
        type: Number,
        default: 40
      },
      assessmentComponents: [
        {
          name: { type: String, default: 'Continuous Assessment' },
          code: { type: String, default: 'CA' },
          maxScore: { type: Number, default: 40 }
        },
        {
          name: { type: String, default: 'Examination' },
          code: { type: String, default: 'EXAM' },
          maxScore: { type: Number, default: 60 }
        }
      ]
    },
    branding: {
      primaryColor: { type: String, default: '#1e3a8a' }, // Deep Navy
      secondaryColor: { type: String, default: '#0284c7' }, // Sky Blue
      accentColor: { type: String, default: '#d97706' }, // Amber/Gold
      idCardOrientation: { type: String, enum: ['portrait', 'landscape'], default: 'portrait' },
      principalSignatureUrl: { type: String, default: '' }
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

SchoolSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  next();
});

export const School = mongoose.model('School', SchoolSchema);
