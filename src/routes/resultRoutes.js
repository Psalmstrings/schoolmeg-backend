import { Router } from 'express';
import {
  getSubjectScoreSheet,
  batchSaveResults,
  approveResults,
  publishClassReportCards,
  getStudentReportCard
} from '../controllers/resultController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/roles.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

// 1. Score Sheet & Score Entry (Teachers & Admins)
router.get(
  '/score-sheet',
  authorizeRoles(
    USER_ROLES.CLASS_TEACHER,
    USER_ROLES.SUBJECT_TEACHER,
    USER_ROLES.SCHOOL_ADMIN,
    USER_ROLES.SUPER_ADMIN
  ),
  getSubjectScoreSheet
);

router.post(
  '/batch-save',
  authorizeRoles(
    USER_ROLES.CLASS_TEACHER,
    USER_ROLES.SUBJECT_TEACHER,
    USER_ROLES.SCHOOL_ADMIN,
    USER_ROLES.SUPER_ADMIN
  ),
  batchSaveResults
);

// 2. Approval & Publishing (Admins Only)
router.post(
  '/approve',
  authorizeRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  approveResults
);

router.post(
  '/publish',
  authorizeRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  publishClassReportCards
);

// 3. Report Card Retrieval (Admin, Teacher, or Parent for their ward)
router.get(
  '/report-card/:studentId',
  authorizeRoles(
    USER_ROLES.PARENT,
    USER_ROLES.CLASS_TEACHER,
    USER_ROLES.SUBJECT_TEACHER,
    USER_ROLES.SCHOOL_ADMIN,
    USER_ROLES.SUPER_ADMIN
  ),
  getStudentReportCard
);

export default router;
