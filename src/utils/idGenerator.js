import { Counter } from '../models/Counter.js';
import { School } from '../models/School.js';

export const generateAdmissionNumber = async (schoolId, sessionYear = null) => {
  const school = await School.findById(schoolId);
  if (!school) throw new Error('School not found for ID generation');

  const schoolCode = school.code.toUpperCase();
  const yearStr = sessionYear
    ? sessionYear.split('/')[0]
    : school.academicSettings?.currentSession?.split('/')[0] || new Date().getFullYear().toString();

  const counterKey = `student_${yearStr}`;

  const counter = await Counter.findOneAndUpdate(
    { schoolId, key: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const paddedSeq = String(counter.seq).padStart(4, '0');
  return `${schoolCode}/${yearStr}/${paddedSeq}`;
};

export const generateStaffId = async (schoolId) => {
  const school = await School.findById(schoolId);
  if (!school) throw new Error('School not found for ID generation');

  const schoolCode = school.code.toUpperCase();
  const counterKey = 'staff_id';

  const counter = await Counter.findOneAndUpdate(
    { schoolId, key: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const paddedSeq = String(counter.seq).padStart(4, '0');
  return `${schoolCode}/STF/${paddedSeq}`;
};

export const generateReceiptNumber = async (schoolId) => {
  const school = await School.findById(schoolId);
  if (!school) throw new Error('School not found for receipt number generation');

  const schoolCode = school.code.toUpperCase();
  const yearStr = new Date().getFullYear().toString();
  const counterKey = `receipt_${yearStr}`;

  const counter = await Counter.findOneAndUpdate(
    { schoolId, key: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const paddedSeq = String(counter.seq).padStart(4, '0');
  return `REC-${schoolCode}-${yearStr}-${paddedSeq}`;
};

