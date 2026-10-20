import { verifyToken } from '../utils/token.js';
import { User } from '../models/User.js';
import { errorResponse } from '../utils/response.js';

export const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // Check cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // Check Authorization header fallback
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return errorResponse(res, 'Authentication required. Please log in.', 401);
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return errorResponse(res, 'Invalid or expired session. Please log in again.', 401);
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return errorResponse(res, 'User account no longer exists.', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account is deactivated. Contact administrator.', 403);
    }

    req.user = user;
    req.schoolId = user.schoolId ? user.schoolId.toString() : null;

    next();
  } catch (error) {
    return errorResponse(res, 'Authentication error: ' + error.message, 500);
  }
};
