import mongoose from 'mongoose';

const ReportCardSchema = new mongoose.Schema(
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
    subjects: [
      {
        subject: { type: String, required: true },
        caScore: { type: Number, default: 0 },
        examScore: { type: Number, default: 0 },
        totalScore: { type: Number, default: 0 },
        grade: { type: String, default: 'F' },
        remark: { type: String, default: 'Fail' },
        teacherRemarks: { type: String, default: '' }
      }
    ],
    summary: {
      totalScoreObtained: { type: Number, default: 0 },
      totalPossibleScore: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      positionInClass: { type: Number, default: null },
      totalStudentsInClass: { type: Number, default: 0 },
      decision: { type: String, default: 'PASSED' }
    },
    attendance: {
      schoolDaysOpened: { type: Number, default: 60 },
      daysPresent: { type: Number, default: 60 },
      daysAbsent: { type: Number, default: 0 }
    },
    affectiveTraits: {
      punctuality: { type: Number, min: 1, max: 5, default: 5 },
      neatness: { type: Number, min: 1, max: 5, default: 5 },
      politeness: { type: Number, min: 1, max: 5, default: 5 },
      honesty: { type: Number, min: 1, max: 5, default: 5 },
      leadership: { type: Number, min: 1, max: 5, default: 4 },
      attentiveness: { type: Number, min: 1, max: 5, default: 5 }
    },
    psychomotorSkills: {
      handwriting: { type: Number, min: 1, max: 5, default: 4 },
      gamesAndSports: { type: Number, min: 1, max: 5, default: 4 },
      crafts: { type: Number, min: 1, max: 5, default: 4 }
    },
    classTeacherComment: {
      type: String,
      default: 'A very diligent and hardworking pupil. Keep it up.'
    },
    principalComment: {
      type: String,
      default: 'An impressive performance. Promoted to the next class.'
    },
    status: {
      type: String,
      enum: ['DRAFT', 'APPROVED', 'PUBLISHED'],
      default: 'DRAFT',
      index: true
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    publishedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

ReportCardSchema.index(
  { schoolId: 1, studentId: 1, academicSession: 1, term: 1 },
  { unique: true }
);

export const ReportCard = mongoose.model('ReportCard', ReportCardSchema);
