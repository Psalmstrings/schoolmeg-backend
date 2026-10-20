import crypto from 'crypto';
import { School } from '../models/School.js';
import { User } from '../models/User.js';
import { USER_ROLES } from '../config/constants.js';
import { signToken, sendTokenCookie, clearTokenCookie } from '../utils/token.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logAudit } from '../utils/auditLogger.js';

export const registerAdmin = async (req, res, next) => {
  try {
    const { school: schoolData, admin: adminData } = req.body;

    // Check if school code or slug already exists
    const existingSchool = await School.findOne({
      $or: [{ code: schoolData.code.toUpperCase() }, { 'contact.email': schoolData.email.toLowerCase() }]
    });

    if (existingSchool) {
      return errorResponse(res, 'A school with this code or email already exists.', 409);
    }

    // Check if admin email already exists
    const existingUser = await User.findOne({ email: adminData.email.toLowerCase() });
    if (existingUser) {
      return errorResponse(res, 'An account with this email address already exists.', 409);
    }

    // Create school
    const newSchool = await School.create({
      name: schoolData.name,
      code: schoolData.code.toUpperCase(),
      schoolType: schoolData.schoolType,
      contact: {
        email: schoolData.email.toLowerCase(),
        phone: schoolData.phone,
        website: schoolData.website || ''
      },
      address: {
        state: schoolData.state,
        lga: schoolData.lga || '',
        street: schoolData.address || ''
      },
      academicSettings: {
        currentSession: schoolData.currentSession || '2025/2026',
        currentTerm: schoolData.currentTerm || 'First Term'
      }
    });

    // Create admin user
    const newUser = await User.create({
      schoolId: newSchool._id,
      fullName: adminData.fullName,
      email: adminData.email.toLowerCase(),
      phone: adminData.phone || schoolData.phone,
      password: adminData.password,
      role: USER_ROLES.SCHOOL_ADMIN,
      isActive: true,
      lastLogin: new Date()
    });

    // Generate JWT
    const token = signToken({
      id: newUser._id,
      role: newUser.role,
      schoolId: newSchool._id
    });

    sendTokenCookie(res, token);

    // Audit log
    await logAudit({
      schoolId: newSchool._id,
      userId: newUser._id,
      action: 'SCHOOL_INITIALIZED',
      entity: 'School',
      entityId: newSchool._id,
      details: { schoolName: newSchool.name, adminEmail: newUser.email },
      req
    });

    return successResponse(
      res,
      'School setup completed successfully. Welcome to SchoolMag!',
      {
        user: newUser,
        school: newSchool,
        token
      },
      201
    );
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password')
      .populate('schoolId');

    if (!user) {
      return errorResponse(res, 'Invalid email or password credentials.', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid email or password credentials.', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'Your account is deactivated. Please contact your school administrator.', 403);
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken({
      id: user._id,
      role: user.role,
      schoolId: user.schoolId?._id || user.schoolId
    });

    sendTokenCookie(res, token);

    await logAudit({
      schoolId: user.schoolId?._id || null,
      userId: user._id,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user._id,
      details: { email: user.email, role: user.role },
      req
    });

    return successResponse(res, 'Login successful', {
      user: user.toJSON(),
      school: user.schoolId,
      token
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res) => {
  clearTokenCookie(res);
  return successResponse(res, 'Logged out successfully');
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('schoolId');
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    return successResponse(res, 'User profile retrieved', {
      user,
      school: user.schoolId
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't leak whether user exists
      return successResponse(
        res,
        'If an account with that email exists, password reset instructions have been generated.'
      );
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    // In a production system, an email is dispatched.
    // For development / testing, we return the resetToken if not in production.
    const isDev = process.env.NODE_ENV !== 'production';

    await logAudit({
      schoolId: user.schoolId,
      userId: user._id,
      action: 'PASSWORD_RESET_REQUESTED',
      entity: 'User',
      entityId: user._id,
      details: { email: user.email },
      req
    });

    return successResponse(
      res,
      'If an account with that email exists, password reset instructions have been generated.',
      isDev ? { devResetToken: resetToken } : {}
    );
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return errorResponse(res, 'Password reset token is invalid or has expired.', 400);
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    await logAudit({
      schoolId: user.schoolId,
      userId: user._id,
      action: 'PASSWORD_RESET_COMPLETED',
      entity: 'User',
      entityId: user._id,
      details: { email: user.email },
      req
    });

    return successResponse(res, 'Password has been reset successfully. You may now log in.');
  } catch (error) {
    next(error);
  }
};
