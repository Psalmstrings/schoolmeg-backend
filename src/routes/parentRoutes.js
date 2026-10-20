import { Router } from 'express';
import {
  getLinkedChildren,
  getChildProfile,
  getChildGateAttendance,
  getChildClassroomAttendance
} from '../controllers/parentController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/roles.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router();

// Protect all parent routes: require authentication and PARENT role (or SCHOOL_ADMIN for troubleshooting)
router.use(authenticate);
router.use(authorizeRoles(USER_ROLES.PARENT, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN));

router.get('/children', getLinkedChildren);
router.get('/children/:studentId', getChildProfile);
router.get('/children/:studentId/attendance/gate', getChildGateAttendance);
router.get('/children/:studentId/attendance/classroom', getChildClassroomAttendance);

export default router;
