import { Router } from 'express';
import {
  getFeeCategories,
  createFeeCategory,
  assessClassFees,
  getStudentFinancialProfile,
  recordPayment,
  getFinancialOverview,
  getReceiptDetails
} from '../controllers/financeController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/roles.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

// 1. Fee Categories
router.get('/categories', getFeeCategories);
router.post(
  '/categories',
  authorizeRoles(USER_ROLES.ACCOUNTANT, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  createFeeCategory
);

// 2. Class Assessment / Billing
router.post(
  '/assess-class',
  authorizeRoles(USER_ROLES.ACCOUNTANT, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  assessClassFees
);

// 3. Overview Statistics
router.get(
  '/overview',
  authorizeRoles(USER_ROLES.ACCOUNTANT, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  getFinancialOverview
);

// 4. Record Payment
router.post(
  '/pay',
  authorizeRoles(USER_ROLES.ACCOUNTANT, USER_ROLES.SCHOOL_ADMIN, USER_ROLES.SUPER_ADMIN),
  recordPayment
);

// 5. Student Account Profile (Accountant, Admin, or Parent for their ward)
router.get(
  '/student/:studentId',
  authorizeRoles(
    USER_ROLES.ACCOUNTANT,
    USER_ROLES.SCHOOL_ADMIN,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PARENT
  ),
  getStudentFinancialProfile
);

// 6. Receipt Details
router.get('/receipt/:receiptNumber', getReceiptDetails);

export default router;
