import { Router } from 'express';
import {
  getOrCreateSession,
  scanClassroomStudent,
  markManualRecord,
  getTeacherSessions
} from '../controllers/classroomAttendanceController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/roles.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

router.post(
  '/session',
  authorizeRoles(USER_ROLES.CLASS_TEACHER, USER_ROLES.SUBJECT_TEACHER, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  getOrCreateSession
);

router.get(
  '/sessions',
  authorizeRoles(USER_ROLES.CLASS_TEACHER, USER_ROLES.SUBJECT_TEACHER, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  getTeacherSessions
);

router.post(
  '/scan',
  authorizeRoles(USER_ROLES.CLASS_TEACHER, USER_ROLES.SUBJECT_TEACHER, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  scanClassroomStudent
);

router.post(
  '/mark-manual',
  authorizeRoles(USER_ROLES.CLASS_TEACHER, USER_ROLES.SUBJECT_TEACHER, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  markManualRecord
);

export default router;
