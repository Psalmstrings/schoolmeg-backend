import { Router } from 'express';
import {
  getSchoolProfile,
  updateSchoolProfile,
  updateSchoolSettings
} from '../controllers/schoolController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/roles.js';
import { validate } from '../middleware/validate.js';
import {
  updateSchoolProfileSchema,
  updateSchoolSettingsSchema
} from '../validators/schoolValidators.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

router.get('/profile', getSchoolProfile);
router.put(
  '/profile',
  authorizeRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(updateSchoolProfileSchema),
  updateSchoolProfile
);

router.get('/settings', getSchoolProfile); // returns full school record including settings
router.put(
  '/settings',
  authorizeRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(updateSchoolSettingsSchema),
  updateSchoolSettings
);

export default router;
