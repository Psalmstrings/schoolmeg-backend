import { SubjectResult } from '../models/SubjectResult.js';
import { ReportCard } from '../models/ReportCard.js';
import { Student } from '../models/Student.js';
import { Class } from '../models/Class.js';
import { School } from '../models/School.js';
import { Guardian } from '../models/Guardian.js';
import {
  calculateGradeAndRemark,
  compileStudentReportCard,
  recalculateClassPositions
} from '../services/resultCalculationService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logAudit } from '../utils/auditLogger.js';

export const getSubjectScoreSheet = async (req, res, next) => {
  try {
    const { classId, arm, subject, session, term } = req.query;

    if (!classId || !arm || !subject) {
      return errorResponse(res, 'classId, arm, and subject are required.', 400);
    }

    const school = await School.findById(req.schoolId);
    const academicSession = session || school?.academicSettings?.currentSession || '2025/2026';
    const currentTerm = term || school?.academicSettings?.currentTerm || 'First Term';

    // 1. Fetch all active students in class & arm
    const students = await Student.find({
      schoolId: req.schoolId,
      currentClass: classId,
      currentArm: arm,
      status: 'ACTIVE'
    }).sort({ surname: 1, firstName: 1 });

    // 2. Fetch existing results
    const existingResults = await SubjectResult.find({
      schoolId: req.schoolId,
      classId,
      arm,
      subject,
      academicSession,
      term: currentTerm
    });

    const resultMap = new Map(existingResults.map((r) => [r.studentId.toString(), r]));

    const scoreSheet = students.map((student) => {
      const resRecord = resultMap.get(student._id.toString());
      return {
        student: {
          _id: student._id,
          admissionNumber: student.admissionNumber,
          fullName: student.fullName,
          passportPhoto: student.passportPhoto
        },
        result: resRecord || null,
        caScore: resRecord ? resRecord.caScore : 0,
        examScore: resRecord ? resRecord.examScore : 0,
        totalScore: resRecord ? resRecord.totalScore : 0,
        grade: resRecord ? resRecord.grade : '-',
        remark: resRecord ? resRecord.remark : '-',
        teacherRemarks: resRecord ? resRecord.teacherRemarks : '',
        status: resRecord ? resRecord.status : 'NOT_ENTERED'
      };
    });

    return successResponse(res, 'Score sheet loaded successfully', {
      academicSession,
      term: currentTerm,
      subject,
      classId,
      arm,
      studentsCount: students.length,
      scoreSheet
    });
  } catch (error) {
    next(error);
  }
};

export const batchSaveResults = async (req, res, next) => {
  try {
    const { classId, arm, subject, session, term, records, submit } = req.body;

    if (!classId || !arm || !subject || !Array.isArray(records)) {
      return errorResponse(res, 'classId, arm, subject, and records array are required.', 400);
    }

    const school = await School.findById(req.schoolId);
    const academicSession = session || school?.academicSettings?.currentSession || '2025/2026';
    const currentTerm = term || school?.academicSettings?.currentTerm || 'First Term';

    const savedRecords = [];
    const status = submit ? 'SUBMITTED' : 'DRAFT';

    for (const item of records) {
      const caScore = Math.min(40, Math.max(0, Number(item.caScore) || 0));
      const examScore = Math.min(60, Math.max(0, Number(item.examScore) || 0));
      const totalScore = caScore + examScore;
      const { grade, remark } = calculateGradeAndRemark(totalScore);

      const record = await SubjectResult.findOneAndUpdate(
        {
          schoolId: req.schoolId,
          studentId: item.studentId,
          classId,
          arm,
          subject,
          academicSession,
          term: currentTerm
        },
        {
          schoolId: req.schoolId,
          studentId: item.studentId,
          classId,
          arm,
          subject,
          academicSession,
          term: currentTerm,
          caScore,
          examScore,
          totalScore,
          grade,
          remark,
          teacherRemarks: item.teacherRemarks || '',
          teacherId: req.user._id,
          status,
          ...(submit ? { submittedAt: new Date() } : {})
        },
        { upsert: true, new: true }
      );

      savedRecords.push(record);
    }

    await logAudit({
      schoolId: req.schoolId,
      userId: req.user._id,
      action: submit ? 'RESULTS_SUBMITTED_FOR_APPROVAL' : 'RESULTS_BATCH_SAVED_AS_DRAFT',
      entity: 'SubjectResult',
      entityId: classId,
      details: { subject, arm, recordCount: savedRecords.length, status },
      req
    });

    return successResponse(
      res,
      submit
        ? `Successfully submitted ${savedRecords.length} student scores for administrative approval.`
        : `Successfully saved ${savedRecords.length} student scores as draft.`,
      { count: savedRecords.length, status }
    );
  } catch (error) {
    next(error);
  }
};

export const approveResults = async (req, res, next) => {
  try {
    const { classId, arm, subject, session, term } = req.body;

    const result = await SubjectResult.updateMany(
      {
        schoolId: req.schoolId,
        classId,
        arm,
        subject,
        academicSession: session,
        term,
        status: { $in: ['SUBMITTED', 'DRAFT'] }
      },
      {
        $set: {
          status: 'APPROVED',
          approvedBy: req.user._id,
          approvedAt: new Date()
        }
      }
    );

    return successResponse(res, `Approved ${result.modifiedCount} subject results.`, {
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    next(error);
  }
};

export const publishClassReportCards = async (req, res, next) => {
  try {
    const { classId, arm, session, term } = req.body;

    if (!classId || !arm || !session || !term) {
      return errorResponse(res, 'classId, arm, session, and term are required', 400);
    }

    // 1. Mark all subject results for this class arm as PUBLISHED
    await SubjectResult.updateMany(
      {
        schoolId: req.schoolId,
        classId,
        arm,
        academicSession: session,
        term
      },
      {
        $set: {
          status: 'PUBLISHED',
          approvedBy: req.user._id,
          approvedAt: new Date()
        }
      }
    );

    // 2. Fetch all students in this class arm
    const students = await Student.find({
      schoolId: req.schoolId,
      currentClass: classId,
      currentArm: arm,
      status: 'ACTIVE'
    });

    // 3. Compile report cards for all students
    for (const student of students) {
      await compileStudentReportCard({
        schoolId: req.schoolId,
        studentId: student._id,
        classId,
        arm,
        academicSession: session,
        term
      });
    }

    // 4. Recalculate class rank/positions
    await recalculateClassPositions({
      schoolId: req.schoolId,
      classId,
      arm,
      academicSession: session,
      term
    });

    // 5. Set status PUBLISHED on ReportCards
    await ReportCard.updateMany(
      {
        schoolId: req.schoolId,
        classId,
        arm,
        academicSession: session,
        term
      },
      {
        $set: {
          status: 'PUBLISHED',
          approvedBy: req.user._id,
          publishedAt: new Date()
        }
      }
    );

    return successResponse(
      res,
      `Report cards for ${arm} compiled, ranked, and published successfully. Visible to parents.`,
      { publishedStudents: students.length }
    );
  } catch (error) {
    next(error);
  }
};

export const getStudentReportCard = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { session, term } = req.query;

    const student = await Student.findOne({ _id: studentId, schoolId: req.schoolId }).populate('currentClass');
    if (!student) {
      return errorResponse(res, 'Student not found.', 404);
    }

    // If requester is a PARENT, verify they own this ward
    if (req.user.role === 'PARENT') {
      const guardian = await Guardian.findOne({
        schoolId: req.schoolId,
        $or: [{ userId: req.user._id }, { email: req.user.email }, { phone: req.user.phone }]
      });

      const isWard = guardian && (
        guardian.wards?.some((w) => w.toString() === studentId) ||
        student.primaryGuardian?.toString() === guardian._id.toString()
      );

      if (!isWard) {
        return errorResponse(res, 'Access denied: unauthorized child report card.', 403);
      }
    }

    const school = await School.findById(req.schoolId);
    const academicSession = session || school?.academicSettings?.currentSession || '2025/2026';
    const currentTerm = term || school?.academicSettings?.currentTerm || 'First Term';

    const filter = {
      schoolId: req.schoolId,
      studentId,
      academicSession,
      term: currentTerm
    };

    // If requester is PARENT, only published report cards are visible
    if (req.user.role === 'PARENT') {
      filter.status = 'PUBLISHED';
    }

    let reportCard = await ReportCard.findOne(filter).populate('classId', 'name level');

    // If not compiled yet and requester is Admin or Teacher, compile on-the-fly
    if (!reportCard && req.user.role !== 'PARENT') {
      reportCard = await compileStudentReportCard({
        schoolId: req.schoolId,
        studentId: student._id,
        classId: student.currentClass._id,
        arm: student.currentArm,
        academicSession,
        term: currentTerm
      });
      reportCard = await ReportCard.findById(reportCard._id).populate('classId', 'name level');
    }

    if (!reportCard) {
      return errorResponse(
        res,
        req.user.role === 'PARENT'
          ? 'Terminal report card is not published yet for this term.'
          : 'Report card not found.',
        404
      );
    }

    return successResponse(res, 'Report card retrieved', {
      school: {
        name: school.name,
        code: school.code,
        logoUrl: school.logoUrl,
        address: school.address,
        contact: school.contact
      },
      student: {
        _id: student._id,
        fullName: student.fullName,
        admissionNumber: student.admissionNumber,
        gender: student.gender,
        passportPhoto: student.passportPhoto,
        class: student.currentClass?.name,
        arm: student.currentArm
      },
      reportCard
    });
  } catch (error) {
    next(error);
  }
};
