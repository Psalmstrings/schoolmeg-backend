import { IDCard } from '../models/IDCard.js';
import { Student } from '../models/Student.js';
import { Staff } from '../models/Staff.js';
import { School } from '../models/School.js';
import { issueStudentCard, issueStaffCard, revokeCard } from '../services/idCardService.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import { logAudit } from '../utils/auditLogger.js';

export const getCards = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '15', 10);
    const skip = (page - 1) * limit;

    const filter = { schoolId: req.schoolId };

    if (req.query.holderType) filter.holderType = req.query.holderType;
    if (req.query.status) filter.status = req.query.status;

    const [cards, total] = await Promise.all([
      IDCard.find(filter)
        .populate({
          path: 'studentId',
          populate: { path: 'currentClass', select: 'name level arms' }
        })
        .populate('staffId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      IDCard.countDocuments(filter)
    ]);

    return paginatedResponse(res, 'ID cards retrieved', cards, { total, page, limit });
  } catch (error) {
    next(error);
  }
};

export const issueCard = async (req, res, next) => {
  try {
    const { holderType, id: holderId, reason } = req.body;

    let card;
    if (holderType === 'STUDENT') {
      card = await issueStudentCard(holderId, req.schoolId, reason);
    } else if (holderType === 'STAFF') {
      card = await issueStaffCard(holderId, req.schoolId, reason);
    } else {
      return errorResponse(res, "Invalid holderType. Must be 'STUDENT' or 'STAFF'.", 400);
    }

    await logAudit({
      schoolId: req.schoolId,
      userId: req.user._id,
      action: 'ID_CARD_ISSUED',
      entity: 'IDCard',
      entityId: card._id,
      details: { cardNumber: card.cardNumber, holderType, holderId },
      req
    });

    const populated = await IDCard.findById(card._id)
      .populate({
        path: 'studentId',
        populate: { path: 'currentClass', select: 'name level' }
      })
      .populate('staffId');

    return successResponse(res, `ID card ${card.cardNumber} issued successfully`, { card: populated }, 201);
  } catch (error) {
    next(error);
  }
};

export const batchIssueCards = async (req, res, next) => {
  try {
    const { target, classId } = req.body; // target: 'CLASS' | 'STAFF'
    const issuedCards = [];

    if (target === 'CLASS' && classId) {
      const students = await Student.find({
        schoolId: req.schoolId,
        currentClass: classId,
        status: 'ACTIVE'
      });

      for (const st of students) {
        const card = await issueStudentCard(st._id, req.schoolId, 'Batch Issuance');
        issuedCards.push(card);
      }
    } else if (target === 'STAFF') {
      const staffMembers = await Staff.find({
        schoolId: req.schoolId,
        status: 'ACTIVE'
      });

      for (const stf of staffMembers) {
        const card = await issueStaffCard(stf._id, req.schoolId, 'Batch Issuance');
        issuedCards.push(card);
      }
    } else {
      return errorResponse(res, 'Invalid batch target or missing classId.', 400);
    }

    await logAudit({
      schoolId: req.schoolId,
      userId: req.user._id,
      action: 'ID_CARDS_BATCH_ISSUED',
      entity: 'IDCard',
      details: { target, count: issuedCards.length },
      req
    });

    return successResponse(
      res,
      `Successfully batch-issued ${issuedCards.length} ID cards.`,
      { count: issuedCards.length }
    );
  } catch (error) {
    next(error);
  }
};

export const handleRevokeCard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const card = await revokeCard(id, req.schoolId, reason || 'Card lost or damaged');

    await logAudit({
      schoolId: req.schoolId,
      userId: req.user._id,
      action: 'ID_CARD_REVOKED',
      entity: 'IDCard',
      entityId: card._id,
      details: { cardNumber: card.cardNumber, reason },
      req
    });

    return successResponse(res, `ID card ${card.cardNumber} has been revoked.`, { card });
  } catch (error) {
    next(error);
  }
};

export const getPrintCards = async (req, res, next) => {
  try {
    const { classId, holderType, cardId } = req.query;
    const filter = { schoolId: req.schoolId, status: 'ACTIVE' };

    if (cardId) {
      filter._id = cardId;
    } else if (holderType) {
      filter.holderType = holderType;
    }

    const [cards, school] = await Promise.all([
      IDCard.find(filter)
        .populate({
          path: 'studentId',
          populate: { path: 'currentClass', select: 'name level arms' }
        })
        .populate('staffId')
        .lean(),
      School.findById(req.schoolId)
    ]);

    // If filtered by classId for students
    let filteredCards = cards;
    if (classId) {
      filteredCards = cards.filter(
        (c) => c.holderType === 'STUDENT' && c.studentId?.currentClass?._id?.toString() === classId
      );
    }

    return successResponse(res, 'Print card payload retrieved', {
      cards: filteredCards,
      school
    });
  } catch (error) {
    next(error);
  }
};
