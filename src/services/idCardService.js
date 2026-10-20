import crypto from 'crypto';
import { IDCard } from '../models/IDCard.js';
import { Student } from '../models/Student.js';
import { Staff } from '../models/Staff.js';
import { School } from '../models/School.js';
import { ID_CARD_STATUS } from '../config/constants.js';

export const issueStudentCard = async (studentId, schoolId, reason = 'Initial Issuance') => {
  const [student, school] = await Promise.all([
    Student.findOne({ _id: studentId, schoolId }),
    School.findById(schoolId)
  ]);

  if (!student) throw new Error('Student not found');
  if (!school) throw new Error('School not found');

  // Deactivate any existing active cards for this student
  const existingCard = await IDCard.findOne({
    schoolId,
    studentId,
    status: ID_CARD_STATUS.ACTIVE
  });

  let reissueCount = 0;
  if (existingCard) {
    existingCard.status = ID_CARD_STATUS.REPLACED;
    existingCard.revokedAt = new Date();
    existingCard.revocationReason = `Replaced by new card (${reason})`;
    await existingCard.save();
    reissueCount = existingCard.reissueCount + 1;
  }

  // Generate opaque unguessable QR token
  const randomSecret = crypto.randomBytes(16).toString('hex');
  const qrCodeString = `SM-STU-${school.code}-${randomSecret}`;
  const cardNumber = `CRD-${school.code}-S${student.admissionNumber.split('/').pop()}-${reissueCount > 0 ? 'R' + reissueCount : '01'}`;

  // Expiry date: 1 year from now or end of academic session
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  const card = await IDCard.create({
    schoolId,
    holderType: 'STUDENT',
    studentId: student._id,
    cardNumber,
    qrCodeString,
    status: ID_CARD_STATUS.ACTIVE,
    issueDate: new Date(),
    expiryDate,
    reissueCount
  });

  return card;
};

export const issueStaffCard = async (staffId, schoolId, reason = 'Initial Issuance') => {
  const [staff, school] = await Promise.all([
    Staff.findOne({ _id: staffId, schoolId }),
    School.findById(schoolId)
  ]);

  if (!staff) throw new Error('Staff record not found');
  if (!school) throw new Error('School not found');

  const existingCard = await IDCard.findOne({
    schoolId,
    staffId,
    status: ID_CARD_STATUS.ACTIVE
  });

  let reissueCount = 0;
  if (existingCard) {
    existingCard.status = ID_CARD_STATUS.REPLACED;
    existingCard.revokedAt = new Date();
    existingCard.revocationReason = `Replaced by new card (${reason})`;
    await existingCard.save();
    reissueCount = existingCard.reissueCount + 1;
  }

  const randomSecret = crypto.randomBytes(16).toString('hex');
  const qrCodeString = `SM-STF-${school.code}-${randomSecret}`;
  const cardNumber = `CRD-${school.code}-T${staff.staffId.split('/').pop()}-${reissueCount > 0 ? 'R' + reissueCount : '01'}`;

  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 2); // 2 years for staff

  const card = await IDCard.create({
    schoolId,
    holderType: 'STAFF',
    staffId: staff._id,
    cardNumber,
    qrCodeString,
    status: ID_CARD_STATUS.ACTIVE,
    issueDate: new Date(),
    expiryDate,
    reissueCount
  });

  return card;
};

export const revokeCard = async (cardId, schoolId, reason = 'Lost or Damaged') => {
  const card = await IDCard.findOne({ _id: cardId, schoolId });
  if (!card) throw new Error('ID Card not found');

  card.status = ID_CARD_STATUS.REVOKED;
  card.revokedAt = new Date();
  card.revocationReason = reason;
  await card.save();

  return card;
};

export const verifyQRToken = async (qrCodeString, schoolId) => {
  const card = await IDCard.findOne({ qrCodeString, schoolId })
    .populate({
      path: 'studentId',
      populate: { path: 'currentClass', select: 'name level arms' }
    })
    .populate('staffId');

  if (!card) {
    return {
      isValid: false,
      reason: 'INVALID_CARD',
      message: 'Unrecognized or unregistered card barcode.'
    };
  }

  if (card.status !== ID_CARD_STATUS.ACTIVE) {
    return {
      isValid: false,
      reason: 'CARD_REVOKED',
      message: `Card is ${card.status.toLowerCase()} and cannot be used for attendance.`
    };
  }

  if (card.holderType === 'STUDENT') {
    const student = card.studentId;
    if (!student || student.status !== 'ACTIVE') {
      return {
        isValid: false,
        reason: 'INACTIVE_STUDENT',
        message: 'Student record is not active or has been archived.'
      };
    }
    return {
      isValid: true,
      card,
      holderType: 'STUDENT',
      student,
      holder: student
    };
  }

  if (card.holderType === 'STAFF') {
    const staff = card.staffId;
    if (!staff || staff.status !== 'ACTIVE') {
      return {
        isValid: false,
        reason: 'INACTIVE_STAFF',
        message: 'Staff member is not active.'
      };
    }
    return {
      isValid: true,
      card,
      holderType: 'STAFF',
      staff,
      holder: staff
    };
  }

  return { isValid: false, reason: 'UNKNOWN_HOLDER', message: 'Unknown card holder.' };
};
