import { Guardian } from '../models/Guardian.js';
import { Student } from '../models/Student.js';
import { GateAttendanceEvent } from '../models/GateAttendanceEvent.js';
import { ClassroomAttendanceRecord } from '../models/ClassroomAttendanceRecord.js';
import { successResponse, errorResponse } from '../utils/response.js';

// Helper to resolve Guardian record for authenticated Parent user
export const getAuthenticatedGuardian = async (userId, schoolId, userEmail = '', userPhone = '') => {
  let guardian = await Guardian.findOne({ schoolId, userId });

  if (!guardian && userEmail) {
    guardian = await Guardian.findOne({ schoolId, email: userEmail.toLowerCase() });
    if (guardian && !guardian.userId) {
      guardian.userId = userId;
      await guardian.save();
    }
  }

  if (!guardian && userPhone) {
    guardian = await Guardian.findOne({ schoolId, phone: userPhone });
    if (guardian && !guardian.userId) {
      guardian.userId = userId;
      await guardian.save();
    }
  }

  return guardian;
};

// Verify if a student is indeed a ward of the authenticated guardian
export const verifyWardAccess = async (guardian, studentId, schoolId) => {
  if (!guardian) return null;

  const student = await Student.findOne({
    _id: studentId,
    schoolId,
    $or: [{ primaryGuardian: guardian._id }, { _id: { $in: guardian.wards || [] } }]
  }).populate('currentClass', 'name level arms subjects');

  return student;
};

export const getLinkedChildren = async (req, res, next) => {
  try {
    const guardian = await getAuthenticatedGuardian(
      req.user._id,
      req.schoolId,
      req.user.email,
      req.user.phone
    );

    if (!guardian) {
      return successResponse(res, 'No guardian profile linked yet', { children: [] });
    }

    const children = await Student.find({
      schoolId: req.schoolId,
      $or: [{ primaryGuardian: guardian._id }, { _id: { $in: guardian.wards || [] } }]
    })
      .populate('currentClass', 'name level arms')
      .sort({ firstName: 1 });

    return successResponse(res, 'Linked children retrieved successfully', {
      guardian: {
        _id: guardian._id,
        fullName: guardian.fullName,
        relationship: guardian.relationship,
        phone: guardian.phone,
        email: guardian.email
      },
      children
    });
  } catch (error) {
    next(error);
  }
};

export const getChildProfile = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const guardian = await getAuthenticatedGuardian(
      req.user._id,
      req.schoolId,
      req.user.email,
      req.user.phone
    );

    if (!guardian) {
      return errorResponse(res, 'Guardian profile not found for this account.', 403);
    }

    const student = await verifyWardAccess(guardian, studentId, req.schoolId);
    if (!student) {
      return errorResponse(res, 'Access denied. You are only authorized to view your own wards.', 403);
    }

    return successResponse(res, 'Child profile retrieved', { student });
  } catch (error) {
    next(error);
  }
};

export const getChildGateAttendance = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const guardian = await getAuthenticatedGuardian(
      req.user._id,
      req.schoolId,
      req.user.email,
      req.user.phone
    );

    if (!guardian) {
      return errorResponse(res, 'Guardian profile not found.', 403);
    }

    const student = await verifyWardAccess(guardian, studentId, req.schoolId);
    if (!student) {
      return errorResponse(res, 'Access denied: unauthorized ward.', 403);
    }

    const filter = {
      schoolId: req.schoolId,
      studentId: student._id
    };

    if (req.query.startDate && req.query.endDate) {
      filter.date = { $gte: req.query.startDate, $lte: req.query.endDate };
    }

    const events = await GateAttendanceEvent.find(filter)
      .sort({ timestamp: -1 })
      .limit(req.query.limit ? parseInt(req.query.limit) : 50)
      .lean();

    const totalEntries = events.filter((e) => e.eventType === 'ENTRY').length;
    const lateArrivals = events.filter((e) => e.eventType === 'ENTRY' && e.isLate).length;
    const onTimeArrivals = totalEntries - lateArrivals;

    return successResponse(res, 'Gate attendance records retrieved', {
      student: {
        _id: student._id,
        fullName: student.fullName,
        admissionNumber: student.admissionNumber
      },
      stats: {
        totalDaysRecorded: totalEntries,
        onTimeArrivals,
        lateArrivals,
        punctualityRate: totalEntries > 0 ? Math.round((onTimeArrivals / totalEntries) * 100) : 100
      },
      events
    });
  } catch (error) {
    next(error);
  }
};

export const getChildClassroomAttendance = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const guardian = await getAuthenticatedGuardian(
      req.user._id,
      req.schoolId,
      req.user.email,
      req.user.phone
    );

    if (!guardian) {
      return errorResponse(res, 'Guardian profile not found.', 403);
    }

    const student = await verifyWardAccess(guardian, studentId, req.schoolId);
    if (!student) {
      return errorResponse(res, 'Access denied: unauthorized ward.', 403);
    }

    const records = await ClassroomAttendanceRecord.find({
      schoolId: req.schoolId,
      studentId: student._id
    })
      .populate({
        path: 'sessionId',
        select: 'date subject arm term session teacherId',
        populate: { path: 'teacherId', select: 'fullName' }
      })
      .sort({ scannedAt: -1 })
      .limit(req.query.limit ? parseInt(req.query.limit) : 50)
      .lean();

    const totalLessons = records.length;
    const presentCount = records.filter((r) => r.status === 'PRESENT').length;
    const absentCount = records.filter((r) => r.status === 'ABSENT').length;
    const lateCount = records.filter((r) => r.status === 'LATE').length;
    const excusedCount = records.filter((r) => r.status === 'EXCUSED').length;

    return successResponse(res, 'Classroom attendance history retrieved', {
      student: {
        _id: student._id,
        fullName: student.fullName,
        admissionNumber: student.admissionNumber
      },
      stats: {
        totalLessons,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        attendanceRate: totalLessons > 0 ? Math.round(((presentCount + lateCount) / totalLessons) * 100) : 100
      },
      records
    });
  } catch (error) {
    next(error);
  }
};
