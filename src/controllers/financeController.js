import { FeeCategory } from '../models/FeeCategory.js';
import { FeeAssessment } from '../models/FeeAssessment.js';
import { PaymentTransaction } from '../models/PaymentTransaction.js';
import { Student } from '../models/Student.js';
import { School } from '../models/School.js';
import { Guardian } from '../models/Guardian.js';
import { generateReceiptNumber } from '../utils/idGenerator.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logAudit } from '../utils/auditLogger.js';

// Default categories seeder
const DEFAULT_CATEGORIES = [
  { name: 'Tuition Fee', defaultAmountKobo: 15000000, isCompulsory: true }, // N150,000
  { name: 'Development Levy', defaultAmountKobo: 2500000, isCompulsory: true }, // N25,000
  { name: 'ICT & Computer Lab Fee', defaultAmountKobo: 1500000, isCompulsory: true }, // N15,000
  { name: 'Terminal Examination Fee', defaultAmountKobo: 1000000, isCompulsory: true }, // N10,000
  { name: 'PTA Levy', defaultAmountKobo: 500000, isCompulsory: true } // N5,000
];

export const getFeeCategories = async (req, res, next) => {
  try {
    let categories = await FeeCategory.find({ schoolId: req.schoolId, isActive: true });

    if (categories.length === 0) {
      const seeded = await FeeCategory.insertMany(
        DEFAULT_CATEGORIES.map((cat) => ({
          ...cat,
          schoolId: req.schoolId
        }))
      );
      categories = seeded;
    }

    return successResponse(res, 'Fee categories retrieved', { categories });
  } catch (error) {
    next(error);
  }
};

export const createFeeCategory = async (req, res, next) => {
  try {
    const { name, defaultAmountKobo, applicableLevels, isCompulsory, description } = req.body;

    if (!name || defaultAmountKobo === undefined) {
      return errorResponse(res, 'Name and defaultAmountKobo are required', 400);
    }

    const category = await FeeCategory.create({
      schoolId: req.schoolId,
      name,
      defaultAmountKobo: Number(defaultAmountKobo),
      applicableLevels: applicableLevels || ['ALL'],
      isCompulsory: isCompulsory !== false,
      description: description || ''
    });

    return successResponse(res, 'Fee category created successfully', { category }, 201);
  } catch (error) {
    next(error);
  }
};

export const assessClassFees = async (req, res, next) => {
  try {
    const { classId, arm, session, term, dueDate, items } = req.body;

    if (!classId || !session || !term) {
      return errorResponse(res, 'classId, session, and term are required', 400);
    }

    // Determine billing items
    let assessmentItems = items;
    if (!assessmentItems || assessmentItems.length === 0) {
      const categories = await FeeCategory.find({ schoolId: req.schoolId, isActive: true });
      assessmentItems = categories.map((c) => ({
        name: c.name,
        amountKobo: c.defaultAmountKobo
      }));
    }

    const totalAmountKobo = assessmentItems.reduce((sum, item) => sum + (Number(item.amountKobo) || 0), 0);

    // Fetch target students
    const filter = { schoolId: req.schoolId, currentClass: classId, status: 'ACTIVE' };
    if (arm && arm !== 'ALL') filter.currentArm = arm;

    const students = await Student.find(filter);

    const assessments = [];
    for (const student of students) {
      const assessment = await FeeAssessment.findOneAndUpdate(
        {
          schoolId: req.schoolId,
          studentId: student._id,
          academicSession: session,
          term
        },
        {
          schoolId: req.schoolId,
          studentId: student._id,
          classId: student.currentClass,
          arm: student.currentArm,
          academicSession: session,
          term,
          items: assessmentItems,
          totalAmountKobo,
          discountKobo: 0,
          netAmountKobo: totalAmountKobo,
          $setOnInsert: {
            paidAmountKobo: 0,
            balanceKobo: totalAmountKobo,
            status: 'UNPAID'
          },
          dueDate: dueDate ? new Date(dueDate) : null
        },
        { upsert: true, new: true }
      );
      assessments.push(assessment);
    }

    await logAudit({
      schoolId: req.schoolId,
      userId: req.user._id,
      action: 'FEES_BATCH_ASSESSED',
      entity: 'FeeAssessment',
      entityId: classId,
      details: { studentsCount: assessments.length, totalAmountKobo },
      req
    });

    return successResponse(
      res,
      `Fee assessments successfully applied to ${assessments.length} students.`,
      { count: assessments.length, totalAmountKobo }
    );
  } catch (error) {
    next(error);
  }
};

export const getStudentFinancialProfile = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    // Verify parent access permission
    if (req.user.role === 'PARENT') {
      const guardian = await Guardian.findOne({
        schoolId: req.schoolId,
        $or: [{ userId: req.user._id }, { email: req.user.email }, { phone: req.user.phone }]
      });

      const student = await Student.findById(studentId);
      const isWard = guardian && (
        guardian.wards?.some((w) => w.toString() === studentId) ||
        student?.primaryGuardian?.toString() === guardian._id.toString()
      );

      if (!isWard) {
        return errorResponse(res, 'Access denied: unauthorized student financial account.', 403);
      }
    }

    const student = await Student.findOne({ _id: studentId, schoolId: req.schoolId }).populate('currentClass');
    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    const assessments = await FeeAssessment.find({ schoolId: req.schoolId, studentId }).sort({ createdAt: -1 });
    const transactions = await PaymentTransaction.find({ schoolId: req.schoolId, studentId })
      .populate('receivedBy', 'fullName')
      .sort({ paymentDate: -1 });

    const totalBilledKobo = assessments.reduce((sum, a) => sum + a.netAmountKobo, 0);
    const totalPaidKobo = transactions.reduce((sum, t) => sum + t.amountPaidKobo, 0);
    const outstandingBalanceKobo = Math.max(0, totalBilledKobo - totalPaidKobo);

    return successResponse(res, 'Student financial profile retrieved', {
      student: {
        _id: student._id,
        fullName: student.fullName,
        admissionNumber: student.admissionNumber,
        class: student.currentClass?.name,
        arm: student.currentArm
      },
      summary: {
        totalBilledKobo,
        totalPaidKobo,
        outstandingBalanceKobo,
        status: outstandingBalanceKobo === 0 ? 'FULLY_PAID' : totalPaidKobo > 0 ? 'PARTIAL' : 'UNPAID'
      },
      assessments,
      transactions
    });
  } catch (error) {
    next(error);
  }
};

export const recordPayment = async (req, res, next) => {
  try {
    const { assessmentId, amountPaidKobo, paymentMethod, referenceNumber, notes, paymentDate } = req.body;

    if (!assessmentId || !amountPaidKobo || amountPaidKobo <= 0) {
      return errorResponse(res, 'assessmentId and positive amountPaidKobo are required.', 400);
    }

    const assessment = await FeeAssessment.findOne({ _id: assessmentId, schoolId: req.schoolId });
    if (!assessment) {
      return errorResponse(res, 'Fee assessment not found', 404);
    }

    const receiptNumber = await generateReceiptNumber(req.schoolId);

    // Create payment transaction
    const transaction = await PaymentTransaction.create({
      schoolId: req.schoolId,
      studentId: assessment.studentId,
      assessmentId: assessment._id,
      receiptNumber,
      amountPaidKobo: Number(amountPaidKobo),
      paymentMethod: paymentMethod || 'BANK_TRANSFER',
      referenceNumber: referenceNumber || '',
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      receivedBy: req.user._id,
      notes: notes || ''
    });

    // Update assessment balance & status
    const newPaidAmount = assessment.paidAmountKobo + Number(amountPaidKobo);
    const newBalance = assessment.netAmountKobo - newPaidAmount;

    let newStatus = 'PARTIAL';
    if (newBalance <= 0) {
      newStatus = newBalance < 0 ? 'OVERPAID' : 'PAID';
    } else if (newPaidAmount === 0) {
      newStatus = 'UNPAID';
    }

    assessment.paidAmountKobo = newPaidAmount;
    assessment.balanceKobo = newBalance;
    assessment.status = newStatus;
    await assessment.save();

    await logAudit({
      schoolId: req.schoolId,
      userId: req.user._id,
      action: 'PAYMENT_RECORDED',
      entity: 'PaymentTransaction',
      entityId: transaction._id,
      details: { receiptNumber, amountPaidKobo, studentId: assessment.studentId },
      req
    });

    return successResponse(
      res,
      `Payment of ₦${(amountPaidKobo / 100).toLocaleString()} successfully recorded. Receipt: ${receiptNumber}`,
      { transaction, assessment },
      201
    );
  } catch (error) {
    next(error);
  }
};

export const getFinancialOverview = async (req, res, next) => {
  try {
    const { session, term } = req.query;
    const filter = { schoolId: req.schoolId };
    if (session) filter.academicSession = session;
    if (term) filter.term = term;

    const assessments = await FeeAssessment.find(filter);
    const totalExpectedKobo = assessments.reduce((sum, a) => sum + a.netAmountKobo, 0);
    const totalCollectedKobo = assessments.reduce((sum, a) => sum + a.paidAmountKobo, 0);
    const totalOutstandingKobo = Math.max(0, totalExpectedKobo - totalCollectedKobo);
    const collectionRate = totalExpectedKobo > 0 ? Math.round((totalCollectedKobo / totalExpectedKobo) * 100) : 100;

    const recentTransactions = await PaymentTransaction.find({ schoolId: req.schoolId })
      .populate('studentId', 'firstName surname admissionNumber currentClass currentArm')
      .populate('receivedBy', 'fullName')
      .sort({ createdAt: -1 })
      .limit(20);

    return successResponse(res, 'Financial overview statistics retrieved', {
      metrics: {
        totalExpectedKobo,
        totalCollectedKobo,
        totalOutstandingKobo,
        collectionRate,
        totalBilledStudents: assessments.length
      },
      recentTransactions
    });
  } catch (error) {
    next(error);
  }
};

export const getReceiptDetails = async (req, res, next) => {
  try {
    const { receiptNumber } = req.params;

    const transaction = await PaymentTransaction.findOne({
      schoolId: req.schoolId,
      receiptNumber
    })
      .populate({
        path: 'studentId',
        select: 'firstName surname admissionNumber currentClass currentArm',
        populate: { path: 'currentClass', select: 'name' }
      })
      .populate('assessmentId')
      .populate('receivedBy', 'fullName email');

    if (!transaction) {
      return errorResponse(res, 'Receipt not found', 404);
    }

    const school = await School.findById(req.schoolId);

    return successResponse(res, 'Receipt details retrieved', {
      school: {
        name: school.name,
        code: school.code,
        logoUrl: school.logoUrl,
        address: school.address,
        contact: school.contact
      },
      transaction
    });
  } catch (error) {
    next(error);
  }
};
