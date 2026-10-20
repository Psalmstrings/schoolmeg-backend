import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditLogController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/roles.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);
router.get(
  '/',
  authorizeRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  getAuditLogs
);

export default router;
