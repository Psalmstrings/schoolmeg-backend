import { AuditLog } from '../models/AuditLog.js';
import { paginatedResponse } from '../utils/response.js';

export const getAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const filter = { schoolId: req.schoolId };

    if (req.query.action) {
      filter.action = req.query.action;
    }
    if (req.query.entity) {
      filter.entity = req.query.entity;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'fullName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter)
    ]);

    return paginatedResponse(res, 'Audit logs retrieved', logs, { total, page, limit });
  } catch (error) {
    next(error);
  }
};
