import { ClassroomAttendanceSession } from '../models/ClassroomAttendanceSession.js';
import { ClassroomAttendanceRecord } from '../models/ClassroomAttendanceRecord.js';
import { Student } from '../models/Student.js';
import { Class } from '../models/Class.js';
import { School } from '../models/School.js';
import { verifyQRToken } from '../services/idCardService.js';
import { getNigeriaDateString } from './gateAttendanceController.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logAudit } from '../utils/auditLogger.js';
import { CLASSROOM_ATTENDANCE_STATUS } from '../config/constants.js';

export const getOrCreateSession = async (req, res, next) => {
  try {
    const { classId, arm, subject, date: reqDate } = req.body;
    const date = reqDate || getNigeriaDateString();

    const classRecord = await Class.findOne({ _id: classId, schoolId: req.schoolId });
    if (!classRecord) {
      return errorResponse(res, 'Class not found', 404);
    }

    const school = await School.findById(req.schoolId);
    const sessionName = school?.academicSettings?.currentSession || '2025/2026';
    const termName = school?.academicSettings?.currentTerm || 'First Term';

    let session = await ClassroomAttendanceSession.findOne({
      schoolId: req.schoolId,
      classId,
      arm: arm || 'A',
      date,
      subject: subject || 'General Roll Call'
    }).populate('classId', 'name level arms');

    if (!session) {
      session = await ClassroomAttendanceSession.create({
        schoolId: req.schoolId,
        classId,
        arm: arm || 'A',
        subject: subject || 'General Roll Call',
        date,
        session: sessionName,
        term: termName,
        teacherId: req.user._id,
        status: 'OPEN'
      });
      session = await ClassroomAttendanceSession.findById(session._id).populate('classId', 'name level arms');
    }

    // Fetch roster of all students in this class and arm
    const roster = await Student.find({
      schoolId: req.schoolId,
      currentClass: classId,
      currentArm: arm || 'A',
      status: 'ACTIVE'
    }).sort({ surname: 1, firstName: 1 });

    // Fetch existing records for this session
    const records = await ClassroomAttendanceRecord.find({
      sessionId: session._id
    }).populate('studentId');

    const recordsByStudentId = new Map(records.map((r) => [r.studentId?._id?.toString(), r]));

    const fullRosterWithStatus = roster.map((student) => {
      const record = recordsByStudentId.get(student._id.toString());
      return {
        student,
        record: record || null,
        status: record ? record.status : 'NOT_MARKED'
      };
    });

    return successResponse(res, 'Classroom session loaded', {
      session,
      roster: fullRosterWithStatus,
      summary: {
        totalStudents: roster.length,
        markedPresent: records.filter((r) => r.status === 'PRESENT').length,
        markedAbsent: records.filter((r) => r.status === 'ABSENT').length,
        markedLate: records.filter((r) => r.status === 'LATE').length,
        markedExcused: records.filter((r) => r.status === 'EXCUSED').length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const scanClassroomStudent = async (req, res, next) => {
  try {
    const { sessionId, qrCodeString } = req.body;

    if (!sessionId || !qrCodeString) {
      return errorResponse(res, 'sessionId and qrCodeString are required.', 400);
    }

    const session = await ClassroomAttendanceSession.findOne({
      _id: sessionId,
      schoolId: req.schoolId
    }).populate('classId');

    if (!session) {
      return errorResponse(res, 'Classroom session not found.', 404);
    }

    // 1. Verify card token
    const verification = await verifyQRToken(qrCodeString.trim(), req.schoolId);
    if (!verification.isValid) {
      return errorResponse(res, verification.message, 422, { reason: verification.reason });
    }

    if (verification.holderType !== 'STUDENT') {
      return errorResponse(res, 'Scanned card belongs to staff, not a student.', 422);
    }

    const student = verification.student;

    // 2. Verify student belongs to this session's class and arm
    const studentClassId = student.currentClass?._id?.toString() || student.currentClass?.toString();
    if (studentClassId !== session.classId._id.toString()) {
      return errorResponse(
        res,
        `Student ${student.fullName} belongs to ${student.currentClass?.name || 'another class'}, not ${session.classId.name}!`,
        409,
        { classMismatch: true }
      );
    }

    if (student.currentArm !== session.arm) {
      return errorResponse(
        res,
        `Student ${student.fullName} belongs to Arm ${student.currentArm}, not Arm ${session.arm}!`,
        409,
        { armMismatch: true }
      );
    }

    // 3. Prevent duplicate attendance in same classroom session
    const existingRecord = await ClassroomAttendanceRecord.findOne({
      sessionId: session._id,
      studentId: student._id
    });

    if (existingRecord) {
      return errorResponse(
        res,
        `${student.fullName} is already marked ${existingRecord.status} in this session.`,
        409,
        { alreadyMarked: true, record: existingRecord }
      );
    }

    // 4. Create classroom attendance record
    const record = await ClassroomAttendanceRecord.create({
      schoolId: req.schoolId,
      sessionId: session._id,
      studentId: student._id,
      status: CLASSROOM_ATTENDANCE_STATUS.PRESENT,
      method: 'QR_SCAN',
      scannedAt: new Date(),
      markedBy: req.user._id
    });

    return successResponse(
      res,
      `Student ${student.fullName} marked PRESENT in ${session.classId.name} ${session.arm}.`,
      { record, student },
      201
    );
  } catch (error) {
    next(error);
  }
};

export const markManualRecord = async (req, res, next) => {
  try {
    const { sessionId, studentId, status, remarks } = req.body;

    if (!sessionId || !studentId || !status) {
      return errorResponse(res, 'sessionId, studentId, and status are required', 400);
    }

    const session = await ClassroomAttendanceSession.findOne({
      _id: sessionId,
      schoolId: req.schoolId
    });

    if (!session) {
      return errorResponse(res, 'Session not found', 404);
    }

    const record = await ClassroomAttendanceRecord.findOneAndUpdate(
      { sessionId: session._id, studentId },
      {
        schoolId: req.schoolId,
        sessionId: session._id,
        studentId,
        status,
        method: 'MANUAL',
        markedBy: req.user._id,
        remarks: remarks || 'Manual teacher update'
      },
      { upsert: true, new: true }
    ).populate('studentId');

    return successResponse(res, 'Attendance status updated', { record });
  } catch (error) {
    next(error);
  }
};

export const getTeacherSessions = async (req, res, next) => {
  try {
    const today = getNigeriaDateString();
    const date = req.query.date || today;

    const sessions = await ClassroomAttendanceSession.find({
      schoolId: req.schoolId,
      date
    })
      .populate('classId', 'name level arms')
      .populate('teacherId', 'fullName email')
      .sort({ createdAt: -1 });

    return successResponse(res, 'Classroom sessions retrieved', { sessions });
  } catch (error) {
    next(error);
  }
};
