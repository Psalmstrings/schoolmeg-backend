import { Student } from '../models/Student.js';
import { Guardian } from '../models/Guardian.js';
import { Class } from '../models/Class.js';
import { generateAdmissionNumber } from '../utils/idGenerator.js';
import { uploadImage, deleteImage } from '../services/uploadService.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import { logAudit } from '../utils/auditLogger.js';

export const getStudents = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '15', 10);
    const skip = (page - 1) * limit;

    const filter = { schoolId: req.schoolId };

    if (req.query.status) {
      filter.status = req.query.status;
    } else if (!req.query.includeArchived) {
      filter.status = { $ne: 'ARCHIVED' };
    }

    if (req.query.classId) {
      filter.currentClass = req.query.classId;
    }

    if (req.query.arm) {
      filter.currentArm = req.query.arm;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [
        { firstName: searchRegex },
        { surname: searchRegex },
        { middleName: searchRegex },
        { admissionNumber: searchRegex }
      ];
    }

    const [students, total] = await Promise.all([
      Student.find(filter)
        .populate('currentClass', 'name level arms')
        .populate('primaryGuardian', 'fullName phone email relationship')
        .sort({ surname: 1, firstName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Student.countDocuments(filter)
    ]);

    return paginatedResponse(res, 'Students retrieved', students, { total, page, limit });
  } catch (error) {
    next(error);
  }
};

export const getStudentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const student = await Student.findOne({ _id: id, schoolId: req.schoolId })
      .populate('currentClass', 'name level arms subjects')
      .populate('primaryGuardian');

    if (!student) {
      return errorResponse(res, 'Student record not found', 404);
    }

    return successResponse(res, 'Student profile retrieved', { student });
  } catch (error) {
    next(error);
  }
};

export const registerStudent = async (req, res, next) => {
  try {
    const {
      firstName,
      middleName,
      surname,
      preferredName,
      dateOfBirth,
      gender,
      nationality,
      stateOfOrigin,
      lga,
      homeAddress,
      admissionSession,
      currentClass: classId,
      currentArm,
      previousSchool,
      medicalInfo,
      guardian
    } = req.body;

    // Verify class exists
    const classRecord = await Class.findOne({ _id: classId, schoolId: req.schoolId });
    if (!classRecord) {
      return errorResponse(res, 'Selected class does not exist.', 400);
    }

    // Handle passport photo if uploaded via multer
    let passportPhoto = { url: '', publicId: '' };
    if (req.file) {
      const uploadResult = await uploadImage(req.file.buffer, req.file.mimetype, 'students');
      passportPhoto = uploadResult;
    } else if (req.body.passportPhotoUrl) {
      passportPhoto = { url: req.body.passportPhotoUrl, publicId: '' };
    }

    // Deduplicate or create Guardian
    let guardianDoc = null;
    if (guardian && guardian.phone) {
      const trimmedPhone = guardian.phone.trim();
      guardianDoc = await Guardian.findOne({
        schoolId: req.schoolId,
        phone: trimmedPhone
      });

      if (!guardianDoc) {
        guardianDoc = await Guardian.create({
          schoolId: req.schoolId,
          fullName: guardian.fullName,
          relationship: guardian.relationship || 'Parent',
          phone: trimmedPhone,
          email: guardian.email ? guardian.email.toLowerCase().trim() : '',
          address: guardian.address || homeAddress,
          emergencyContact: guardian.emergencyContact || { name: '', phone: '' },
          authorizedPickupContacts: guardian.authorizedPickupContacts || []
        });
      }
    }

    // Generate unique sequential admission number
    const admissionNumber = await generateAdmissionNumber(req.schoolId, admissionSession);

    // Create student
    const student = await Student.create({
      schoolId: req.schoolId,
      admissionNumber,
      firstName,
      middleName: middleName || '',
      surname,
      preferredName: preferredName || '',
      passportPhoto,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      nationality: nationality || 'Nigerian',
      stateOfOrigin: stateOfOrigin || '',
      lga: lga || '',
      homeAddress,
      admissionSession,
      admissionDate: req.body.admissionDate ? new Date(req.body.admissionDate) : new Date(),
      currentClass: classRecord._id,
      currentArm: currentArm || classRecord.arms[0] || 'A',
      previousSchool: previousSchool || '',
      medicalInfo: medicalInfo || {},
      primaryGuardian: guardianDoc ? guardianDoc._id : null
    });

    // Link ward to guardian
    if (guardianDoc) {
      if (!guardianDoc.wards.includes(student._id)) {
        guardianDoc.wards.push(student._id);
        await guardianDoc.save();
      }
    }

    await logAudit({
      schoolId: req.schoolId,
      userId: req.user._id,
      action: 'STUDENT_REGISTERED',
      entity: 'Student',
      entityId: student._id,
      details: {
        admissionNumber: student.admissionNumber,
        fullName: student.fullName,
        class: classRecord.name
      },
      req
    });

    const populatedStudent = await Student.findById(student._id)
      .populate('currentClass', 'name level')
      .populate('primaryGuardian');

    return successResponse(
      res,
      `Student ${student.fullName} registered successfully with Admission No: ${student.admissionNumber}`,
      { student: populatedStudent },
      201
    );
  } catch (error) {
    next(error);
  }
};

export const updateStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const student = await Student.findOne({ _id: id, schoolId: req.schoolId });
    if (!student) {
      return errorResponse(res, 'Student record not found', 404);
    }

    // Handle photo replacement
    if (req.file) {
      if (student.passportPhoto?.publicId) {
        await deleteImage(student.passportPhoto.publicId);
      }
      student.passportPhoto = await uploadImage(req.file.buffer, req.file.mimetype, 'students');
    }

    const updatableFields = [
      'firstName', 'middleName', 'surname', 'preferredName', 'gender',
      'nationality', 'stateOfOrigin', 'lga', 'homeAddress', 'previousSchool',
      'currentArm', 'status'
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        student[field] = req.body[field];
      }
    });

    if (req.body.dateOfBirth) {
      student.dateOfBirth = new Date(req.body.dateOfBirth);
    }
    if (req.body.currentClass) {
      student.currentClass = req.body.currentClass;
    }
    if (req.body.medicalInfo) {
      student.medicalInfo = { ...student.medicalInfo, ...req.body.medicalInfo };
    }

    await student.save();

    await logAudit({
      schoolId: req.schoolId,
      userId: req.user._id,
      action: 'STUDENT_UPDATED',
      entity: 'Student',
      entityId: student._id,
      details: { admissionNumber: student.admissionNumber, updatedFields: Object.keys(req.body) },
      req
    });

    const populated = await Student.findById(student._id)
      .populate('currentClass', 'name level arms')
      .populate('primaryGuardian');

    return successResponse(res, 'Student profile updated successfully', { student: populated });
  } catch (error) {
    next(error);
  }
};

export const archiveStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const student = await Student.findOne({ _id: id, schoolId: req.schoolId });
    if (!student) {
      return errorResponse(res, 'Student record not found', 404);
    }

    student.status = 'ARCHIVED';
    student.isArchived = true;
    await student.save();

    await logAudit({
      schoolId: req.schoolId,
      userId: req.user._id,
      action: 'STUDENT_ARCHIVED',
      entity: 'Student',
      entityId: student._id,
      details: { admissionNumber: student.admissionNumber },
      req
    });

    return successResponse(res, 'Student archived successfully', { student });
  } catch (error) {
    next(error);
  }
};
