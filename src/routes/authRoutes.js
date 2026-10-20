import { Router } from 'express';
import {
  registerAdmin,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword
} from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import {
  registerAdminSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from '../validators/authValidators.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register-admin', validate(registerAdminSchema), registerAdmin);
router.post('/login', validate(loginSchema), login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

export default router;
