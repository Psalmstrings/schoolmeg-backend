import { Router } from 'express';
import {
  getStudents,
  getStudentById,
  registerStudent,
  updateStudent,
  archiveStudent
} from '../controllers/studentController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/roles.js';
import { upload } from '../services/uploadService.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

router.get('/', getStudents);
router.get('/:id', getStudentById);

router.post(
  '/',
  authorizeRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  upload.single('passportPhoto'),
  registerStudent
);

router.put(
  '/:id',
  authorizeRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  upload.single('passportPhoto'),
  updateStudent
);

router.delete(
  '/:id',
  authorizeRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  archiveStudent
);

export default router;
