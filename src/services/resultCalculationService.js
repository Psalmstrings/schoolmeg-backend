import { SubjectResult } from '../models/SubjectResult.js';
import { ReportCard } from '../models/ReportCard.js';
import { GateAttendanceEvent } from '../models/GateAttendanceEvent.js';
import { ClassroomAttendanceRecord } from '../models/ClassroomAttendanceRecord.js';
import { Student } from '../models/Student.js';

export const calculateGradeAndRemark = (totalScore) => {
  const score = Math.round(totalScore);
  if (score >= 75) return { grade: 'A', remark: 'Excellent' };
  if (score >= 65) return { grade: 'B', remark: 'Very Good' };
  if (score >= 50) return { grade: 'C', remark: 'Credit' };
  if (score >= 40) return { grade: 'D', remark: 'Pass' };
  return { grade: 'F', remark: 'Fail' };
};

export const compileStudentReportCard = async ({
  schoolId,
  studentId,
  classId,
  arm,
  academicSession,
  term
}) => {
  // 1. Fetch all subject results for this student
  const subjectResults = await SubjectResult.find({
    schoolId,
    studentId,
    academicSession,
    term
  });

  const subjects = subjectResults.map((sr) => ({
    subject: sr.subject,
    caScore: sr.caScore,
    examScore: sr.examScore,
    totalScore: sr.totalScore,
    grade: sr.grade,
    remark: sr.remark,
    teacherRemarks: sr.teacherRemarks || ''
  }));

  const totalPossibleScore = subjects.length * 100;
  const totalScoreObtained = subjects.reduce((sum, s) => sum + s.totalScore, 0);
  const averageScore = subjects.length > 0 ? Number((totalScoreObtained / subjects.length).toFixed(1)) : 0;

  // 2. Compute attendance records (Gate and Classroom)
  const gateEntries = await GateAttendanceEvent.countDocuments({
    schoolId,
    studentId,
    eventType: 'ENTRY'
  });

  const classroomPresents = await ClassroomAttendanceRecord.countDocuments({
    schoolId,
    studentId,
    status: { $in: ['PRESENT', 'LATE'] }
  });

  const daysPresent = Math.max(gateEntries, classroomPresents);
  const schoolDaysOpened = Math.max(daysPresent + 2, 60); // standard ~60-65 days per term

  // 3. Upsert Report Card
  const reportCard = await ReportCard.findOneAndUpdate(
    {
      schoolId,
      studentId,
      academicSession,
      term
    },
    {
      schoolId,
      studentId,
      classId,
      arm,
      academicSession,
      term,
      subjects,
      'summary.totalScoreObtained': totalScoreObtained,
      'summary.totalPossibleScore': totalPossibleScore,
      'summary.averageScore': averageScore,
      'summary.decision': averageScore >= 40 ? 'PASSED' : 'PROMOTED ON TRIAL',
      'attendance.schoolDaysOpened': schoolDaysOpened,
      'attendance.daysPresent': daysPresent,
      'attendance.daysAbsent': Math.max(0, schoolDaysOpened - daysPresent)
    },
    { upsert: true, new: true }
  );

  return reportCard;
};

export const recalculateClassPositions = async ({
  schoolId,
  classId,
  arm,
  academicSession,
  term
}) => {
  // Fetch all report cards in this class arm
  const reportCards = await ReportCard.find({
    schoolId,
    classId,
    arm,
    academicSession,
    term
  }).sort({ 'summary.averageScore': -1 });

  const totalStudents = reportCards.length;

  // Assign standard competition ranking (1, 2, 3...)
  for (let i = 0; i < reportCards.length; i++) {
    reportCards[i].summary.positionInClass = i + 1;
    reportCards[i].summary.totalStudentsInClass = totalStudents;
    await reportCards[i].save();
  }

  return reportCards;
};
