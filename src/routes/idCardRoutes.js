import { Router } from 'express';
import {
  getCards,
  issueCard,
  batchIssueCards,
  handleRevokeCard,
  getPrintCards
} from '../controllers/idCardController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/roles.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

router.get('/', getCards);
router.get('/print-data', getPrintCards);

router.post(
  '/issue',
  authorizeRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  issueCard
);

router.post(
  '/batch-issue',
  authorizeRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  batchIssueCards
);

router.post(
  '/:id/revoke',
  authorizeRoles(USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  handleRevokeCard
);

export default router;
