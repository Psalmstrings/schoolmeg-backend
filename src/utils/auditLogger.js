import { AuditLog } from '../models/AuditLog.js';

export const logAudit = async ({
  schoolId,
  userId,
  action,
  entity,
  entityId = '',
  details = {},
  req = null
}) => {
  try {
    let ipAddress = '';
    let userAgent = '';

    if (req) {
      ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
      userAgent = req.headers['user-agent'] || '';
      if (!schoolId && req.schoolId) {
        schoolId = req.schoolId;
      }
      if (!userId && req.user?._id) {
        userId = req.user._id;
      }
    }

    await AuditLog.create({
      schoolId,
      userId,
      action,
      entity,
      entityId: String(entityId),
      details,
      ipAddress: String(ipAddress),
      userAgent: String(userAgent)
    });
  } catch (error) {
    console.error('[AuditLog Error]', error.message);
  }
};
