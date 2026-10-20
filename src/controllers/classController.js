import { Class } from '../models/Class.js';
import { Student } from '../models/Student.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logAudit } from '../utils/auditLogger.js';

export const getClasses = async (req, res, next) => {
  try {
    const classes = await Class.find({ schoolId: req.schoolId, isActive: true })
      .sort({ createdAt: 1 })
      .lean();

    // Attach student count per class
    const classesWithCount = await Promise.all(
      classes.map(async (cls) => {
        const studentCount = await Student.countDocuments({
          schoolId: req.schoolId,
          currentClass: cls._id,
          status: 'ACTIVE'
        });
        return { ...cls, studentCount };
      })
    );

    return successResponse(res, 'Classes retrieved', { classes: classesWithCount });
  } catch (error) {
    next(error);
  }
};

export const createClass = async (req, res, next) => {
  try {
    const { name, level, arms, subjects } = req.body;

    const existingClass = await Class.findOne({
      schoolId: req.schoolId,
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingClass) {
      return errorResponse(res, `A class named '${name}' already exists in this school.`, 409);
    }

    const newClass = await Class.create({
      schoolId: req.schoolId,
      name,
      level: level || 'PRIMARY',
      arms: arms && arms.length > 0 ? arms : ['A'],
      subjects: subjects && subjects.length > 0 ? subjects : undefined
    });

    await logAudit({
      schoolId: req.schoolId,
      userId: req.user._id,
      action: 'CLASS_CREATED',
      entity: 'Class',
      entityId: newClass._id,
      details: { name: newClass.name, arms: newClass.arms },
      req
    });

    return successResponse(res, `Class '${name}' created successfully`, { class: newClass }, 201);
  } catch (error) {
    next(error);
  }
};

export const updateClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, level, arms, subjects } = req.body;

    const classRecord = await Class.findOne({ _id: id, schoolId: req.schoolId });
    if (!classRecord) {
      return errorResponse(res, 'Class not found', 404);
    }

    if (name) classRecord.name = name;
    if (level) classRecord.level = level;
    if (arms) classRecord.arms = arms;
    if (subjects) classRecord.subjects = subjects;

    await classRecord.save();

    await logAudit({
      schoolId: req.schoolId,
      userId: req.user._id,
      action: 'CLASS_UPDATED',
      entity: 'Class',
      entityId: classRecord._id,
      details: { name: classRecord.name, arms: classRecord.arms },
      req
    });

    return successResponse(res, 'Class updated successfully', { class: classRecord });
  } catch (error) {
    next(error);
  }
};
