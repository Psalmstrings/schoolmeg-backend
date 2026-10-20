export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SCHOOL_ADMIN: 'SCHOOL_ADMIN',
  CLASS_TEACHER: 'CLASS_TEACHER',
  SUBJECT_TEACHER: 'SUBJECT_TEACHER',
  GATE_OFFICER: 'GATE_OFFICER',
  ACCOUNTANT: 'ACCOUNTANT',
  PARENT: 'PARENT'
};

export const ALL_ROLES = Object.values(USER_ROLES);

export const SCHOOL_TYPES = {
  NURSERY: 'NURSERY',
  PRIMARY: 'PRIMARY',
  SECONDARY: 'SECONDARY',
  COMBINED: 'COMBINED'
};

export const STUDENT_STATUS = {
  ACTIVE: 'ACTIVE',
  GRADUATED: 'GRADUATED',
  WITHDRAWN: 'WITHDRAWN',
  TRANSFERRED: 'TRANSFERRED',
  SUSPENDED: 'SUSPENDED',
  ARCHIVED: 'ARCHIVED'
};

export const STAFF_STATUS = {
  ACTIVE: 'ACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  RESIGNED: 'RESIGNED',
  TERMINATED: 'TERMINATED',
  ARCHIVED: 'ARCHIVED'
};

export const EMPLOYMENT_TYPES = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  CONTRACT: 'CONTRACT'
};

export const GATE_ATTENDANCE_STATUS = {
  NOT_ARRIVED: 'NOT_ARRIVED',
  PRESENT_ON_CAMPUS: 'PRESENT_ON_CAMPUS',
  EXITED_CAMPUS: 'EXITED_CAMPUS',
  LATE_ARRIVAL: 'LATE_ARRIVAL',
  INCOMPLETE_RECORD: 'INCOMPLETE_RECORD',
  MANUAL_CORRECTION: 'MANUAL_CORRECTION'
};

export const CLASSROOM_ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  EXCUSED: 'EXCUSED'
};

export const RESULT_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  PUBLISHED: 'PUBLISHED'
};

export const ID_CARD_STATUS = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  REPLACED: 'REPLACED'
};

export const PAYMENT_METHODS = {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK_TRANSFER',
  POS: 'POS',
  ONLINE: 'ONLINE',
  CHEQUE: 'CHEQUE'
};

export const TRANSACTION_TYPES = {
  PAYMENT: 'PAYMENT',
  DISCOUNT: 'DISCOUNT',
  WAIVER: 'WAIVER',
  ADJUSTMENT: 'ADJUSTMENT',
  REVERSAL: 'REVERSAL'
};

export const DEFAULT_NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara'
];

export const DEFAULT_GRADING_SCALE = [
  { grade: 'A1', minScore: 75, maxScore: 100, description: 'Excellent', gradePoint: 5.0 },
  { grade: 'B2', minScore: 70, maxScore: 74, description: 'Very Good', gradePoint: 4.0 },
  { grade: 'B3', minScore: 65, maxScore: 69, description: 'Good', gradePoint: 3.5 },
  { grade: 'C4', minScore: 60, maxScore: 64, description: 'Credit', gradePoint: 3.0 },
  { grade: 'C5', minScore: 55, maxScore: 59, description: 'Credit', gradePoint: 2.5 },
  { grade: 'C6', minScore: 50, maxScore: 54, description: 'Credit', gradePoint: 2.0 },
  { grade: 'D7', minScore: 45, maxScore: 49, description: 'Pass', gradePoint: 1.5 },
  { grade: 'E8', minScore: 40, maxScore: 44, description: 'Pass', gradePoint: 1.0 },
  { grade: 'F9', minScore: 0, maxScore: 39, description: 'Fail', gradePoint: 0.0 }
];
