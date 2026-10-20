import { GateAttendanceEvent } from '../models/GateAttendanceEvent.js';
import { Student } from '../models/Student.js';
import { Staff } from '../models/Staff.js';
import { School } from '../models/School.js';
import { IDCard } from '../models/IDCard.js';
import { verifyQRToken } from '../services/idCardService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logAudit } from '../utils/auditLogger.js';
import { GATE_ATTENDANCE_STATUS } from '../config/constants.js';

// Helper to get local Nigeria Date string (YYYY-MM-DD)
export const getNigeriaDateString = (dateObj = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dateObj);
};

// Helper to get local Nigeria Time string (HH:MM)
export const getNigeriaTimeString = (dateObj = new Date()) => {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(dateObj);
};

export const scanGate = async (req, res, next) => {
  try {
    const { qrCodeString, requestedEventType, gateName, notes } = req.body;

    if (!qrCodeString) {
      return errorResponse(res, 'QR code string is required', 400);
    }

    // 1. Validate QR token against active institutional cards
    const verification = await verifyQRToken(qrCodeString.trim(), req.schoolId);
    if (!verification.isValid) {
      return errorResponse(res, verification.message, 422, { reason: verification.reason });
    }

    const { card, holderType, holder } = verification;
    const studentId = holderType === 'STUDENT' ? holder._id : null;
    const staffId = holderType === 'STAFF' ? holder._id : null;

    const school = await School.findById(req.schoolId);
    const today = getNigeriaDateString();
    const currentTimeStr = getNigeriaTimeString();

    // 2. Fetch today's movement history for this person to drive state machine
    const todayEvents = await GateAttendanceEvent.find({
      schoolId: req.schoolId,
      date: today,
      ...(holderType === 'STUDENT' ? { studentId } : { staffId })
    }).sort({ timestamp: -1 });

    const latestEvent = todayEvents[0] || null;

    // Duplicate scan protection: block scans within 30 seconds
    if (latestEvent) {
      const secondsSinceLastScan = (Date.now() - new Date(latestEvent.timestamp).getTime()) / 1000;
      if (secondsSinceLastScan < 30) {
        return errorResponse(
          res,
          `Card scanned too quickly. Please wait ${Math.ceil(30 - secondsSinceLastScan)}s to prevent duplicates.`,
          429,
          { cooldown: true }
        );
      }
    }

    // 3. Determine event transition (ENTRY vs EXIT)
    let eventType = requestedEventType;
    if (!eventType || eventType === 'AUTO') {
      if (!latestEvent || latestEvent.eventType === 'EXIT') {
        eventType = 'ENTRY';
      } else {
        eventType = 'EXIT';
      }
    }

    // 4. Check for Late Arrival
    let isLate = false;
    let campusStatus = GATE_ATTENDANCE_STATUS.PRESENT_ON_CAMPUS;

    if (eventType === 'ENTRY') {
      const lateThreshold = school?.attendanceRules?.lateThresholdTime || '08:15';
      if (currentTimeStr > lateThreshold) {
        isLate = true;
        campusStatus = GATE_ATTENDANCE_STATUS.LATE_ARRIVAL;
      }
    } else {
      campusStatus = GATE_ATTENDANCE_STATUS.EXITED_CAMPUS;
    }

    // 5. Record movement event
    const event = await GateAttendanceEvent.create({
      schoolId: req.schoolId,
      holderType,
      studentId,
      staffId,
      idCardId: card._id,
      eventType,
      date: today,
      timestamp: new Date(),
      operatorId: req.user._id,
      gateName: gateName || 'Main Campus Gate',
      isLate,
      status: campusStatus,
      notes: notes || ''
    });

    const isStudent = holderType === 'STUDENT';
    const message = eventType === 'ENTRY'
      ? `${isStudent ? 'Pupil' : 'Staff'} ${holder.fullName} marked arrived ${isLate ? '(LATE)' : 'on time'}.`
      : `${isStudent ? 'Pupil' : 'Staff'} ${holder.fullName} marked exited campus.`;

    return successResponse(
      res,
      message,
      {
        event,
        eventType,
        isLate,
        campusStatus,
        holderType,
        holder: {
          _id: holder._id,
          fullName: holder.fullName,
          passportPhoto: holder.passportPhoto,
          identifier: isStudent ? holder.admissionNumber : holder.staffId,
          detail: isStudent
            ? `${holder.currentClass?.name || 'Class'} (Arm ${holder.currentArm})`
            : `${holder.designation} • ${holder.department}`
        }
      },
      201
    );
  } catch (error) {
    next(error);
  }
};

export const manualGateEntry = async (req, res, next) => {
  try {
    const { identifier, eventType, gateName, notes } = req.body;
    if (!identifier) {
      return errorResponse(res, 'Admission number or Staff ID is required for manual entry.', 400);
    }

    const trimmedId = identifier.trim().toUpperCase();

    // Look for student or staff
    const [student, staff] = await Promise.all([
      Student.findOne({ schoolId: req.schoolId, admissionNumber: trimmedId, status: 'ACTIVE' }).populate('currentClass'),
      Staff.findOne({ schoolId: req.schoolId, staffId: trimmedId, status: 'ACTIVE' })
    ]);

    if (!student && !staff) {
      return errorResponse(res, `No active student or staff found with ID '${trimmedId}'.`, 404);
    }

    const holderType = student ? 'STUDENT' : 'STAFF';
    const holder = student || staff;

    // Find active card for reference
    const card = await IDCard.findOne({
      schoolId: req.schoolId,
      holderType,
      ...(student ? { studentId: student._id } : { staffId: staff._id }),
      status: 'ACTIVE'
    });

    const today = getNigeriaDateString();
    const currentTimeStr = getNigeriaTimeString();
    const school = await School.findById(req.schoolId);

    const isLate = eventType === 'ENTRY' && currentTimeStr > (school?.attendanceRules?.lateThresholdTime || '08:15');
    const campusStatus = eventType === 'ENTRY'
      ? isLate ? GATE_ATTENDANCE_STATUS.LATE_ARRIVAL : GATE_ATTENDANCE_STATUS.PRESENT_ON_CAMPUS
      : GATE_ATTENDANCE_STATUS.EXITED_CAMPUS;

    const event = await GateAttendanceEvent.create({
      schoolId: req.schoolId,
      holderType,
      studentId: student ? student._id : null,
      staffId: staff ? staff._id : null,
      idCardId: card ? card._id : null,
      eventType: eventType || 'ENTRY',
      date: today,
      timestamp: new Date(),
      operatorId: req.user._id,
      gateName: gateName || 'Main Campus Gate (Manual)',
      isLate,
      status: campusStatus,
      isManualCorrection: true,
      notes: notes || 'Manual verification by gate operator'
    });

    await logAudit({
      schoolId: req.schoolId,
      userId: req.user._id,
      action: 'GATE_MANUAL_ENTRY_RECORDED',
      entity: 'GateAttendanceEvent',
      entityId: event._id,
      details: { identifier: trimmedId, eventType: event.eventType },
      req
    });

    return successResponse(res, `Manual ${event.eventType} recorded for ${holder.fullName}`, {
      event,
      holderType,
      holder
    });
  } catch (error) {
    next(error);
  }
};

export const getDailyGateReport = async (req, res, next) => {
  try {
    const today = getNigeriaDateString();
    const date = req.query.date || today;

    const filter = { schoolId: req.schoolId, date };

    if (req.query.holderType) filter.holderType = req.query.holderType;
    if (req.query.eventType) filter.eventType = req.query.eventType;

    const events = await GateAttendanceEvent.find(filter)
      .populate({
        path: 'studentId',
        select: 'firstName surname admissionNumber currentClass currentArm passportPhoto',
        populate: { path: 'currentClass', select: 'name' }
      })
      .populate('staffId', 'fullName staffId designation department passportPhoto')
      .populate('operatorId', 'fullName email')
      .sort({ timestamp: -1 })
      .lean();

    // Summary statistics
    const totalEntries = events.filter((e) => e.eventType === 'ENTRY').length;
    const totalExits = events.filter((e) => e.eventType === 'EXIT').length;
    const totalLate = events.filter((e) => e.eventType === 'ENTRY' && e.isLate).length;

    return successResponse(res, 'Daily gate movement report retrieved', {
      date,
      totalEvents: events.length,
      stats: {
        totalEntries,
        totalExits,
        totalLate,
        currentlyOnCampus: Math.max(0, totalEntries - totalExits)
      },
      events
    });
  } catch (error) {
    next(error);
  }
};
