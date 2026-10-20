import { School } from '../models/School.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logAudit } from '../utils/auditLogger.js';

export const getSchoolProfile = async (req, res, next) => {
  try {
    const school = await School.findById(req.schoolId);
    if (!school) {
      return errorResponse(res, 'School record not found', 404);
    }
    return successResponse(res, 'School profile retrieved', { school });
  } catch (error) {
    next(error);
  }
};

export const updateSchoolProfile = async (req, res, next) => {
  try {
    const school = await School.findById(req.schoolId);
    if (!school) {
      return errorResponse(res, 'School record not found', 404);
    }

    const { name, motto, schoolType, logoUrl, contact, address } = req.body;

    if (name) school.name = name;
    if (motto !== undefined) school.motto = motto;
    if (schoolType) school.schoolType = schoolType;
    if (logoUrl !== undefined) school.logoUrl = logoUrl;
    if (contact) {
      school.contact = { ...school.contact.toObject(), ...contact };
    }
    if (address) {
      school.address = { ...school.address.toObject(), ...address };
    }

    await school.save();

    await logAudit({
      schoolId: school._id,
      userId: req.user._id,
      action: 'UPDATE_SCHOOL_PROFILE',
      entity: 'School',
      entityId: school._id,
      details: { updatedFields: Object.keys(req.body) },
      req
    });

    return successResponse(res, 'School profile updated successfully', { school });
  } catch (error) {
    next(error);
  }
};

export const updateSchoolSettings = async (req, res, next) => {
  try {
    const school = await School.findById(req.schoolId);
    if (!school) {
      return errorResponse(res, 'School record not found', 404);
    }

    const { academicSettings, attendanceRules, branding, gradingPolicy } = req.body;

    if (academicSettings) {
      school.academicSettings = { ...school.academicSettings.toObject(), ...academicSettings };
    }
    if (attendanceRules) {
      school.attendanceRules = { ...school.attendanceRules.toObject(), ...attendanceRules };
    }
    if (branding) {
      school.branding = { ...school.branding.toObject(), ...branding };
    }
    if (gradingPolicy) {
      if (gradingPolicy.passThreshold !== undefined) {
        school.gradingPolicy.passThreshold = gradingPolicy.passThreshold;
      }
      if (gradingPolicy.scale) {
        school.gradingPolicy.scale = gradingPolicy.scale;
      }
      if (gradingPolicy.assessmentComponents) {
        school.gradingPolicy.assessmentComponents = gradingPolicy.assessmentComponents;
      }
    }

    await school.save();

    await logAudit({
      schoolId: school._id,
      userId: req.user._id,
      action: 'UPDATE_SCHOOL_SETTINGS',
      entity: 'School',
      entityId: school._id,
      details: { updatedSections: Object.keys(req.body) },
      req
    });

    return successResponse(res, 'School configuration updated successfully', { school });
  } catch (error) {
    next(error);
  }
};
