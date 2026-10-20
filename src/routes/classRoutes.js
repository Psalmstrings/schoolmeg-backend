import { Router } from 'express';
import { getClasses, createClass, updateClass } from '../controllers/classController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/roles.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

router.get('/', getClasses);
router.post(
  '/',
  authorizeRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  createClass
);
router.put(
  '/:id',
  authorizeRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  updateClass
);

export default router;
