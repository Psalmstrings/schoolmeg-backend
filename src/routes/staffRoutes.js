import { Router } from 'express';
import {
  getStaff,
  getStaffById,
  registerStaff,
  updateStaff
} from '../controllers/staffController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/roles.js';
import { upload } from '../services/uploadService.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

router.get('/', getStaff);
router.get('/:id', getStaffById);

router.post(
  '/',
  authorizeRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  upload.single('passportPhoto'),
  registerStaff
);

router.put(
  '/:id',
  authorizeRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  upload.single('passportPhoto'),
  updateStaff
);

export default router;
