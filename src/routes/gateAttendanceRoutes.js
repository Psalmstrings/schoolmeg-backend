import { Router } from 'express';
import { scanGate, manualGateEntry, getDailyGateReport } from '../controllers/gateAttendanceController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/roles.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

router.post(
  '/scan',
  authorizeRoles(USER_ROLES.GATE_OFFICER, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  scanGate
);

router.post(
  '/manual',
  authorizeRoles(USER_ROLES.GATE_OFFICER, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  manualGateEntry
);

router.get('/daily', getDailyGateReport);
router.get('/daily-report', getDailyGateReport);

export default router;
