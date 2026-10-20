import { Staff } from '../models/Staff.js';
import { User } from '../models/User.js';
import { generateStaffId } from '../utils/idGenerator.js';
import { uploadImage, deleteImage } from '../services/uploadService.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import { logAudit } from '../utils/auditLogger.js';

export const getStaff = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '15', 10);
    const skip = (page - 1) * limit;

    const filter = { schoolId: req.schoolId };

    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.department) {
      filter.department = req.query.department;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    } else if (!req.query.includeArchived) {
      filter.status = { $ne: 'ARCHIVED' };
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [
        { fullName: searchRegex },
        { staffId: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    const [staffList, total] = await Promise.all([
      Staff.find(filter)
        .populate('assignedClasses.classId', 'name level arms')
        .sort({ fullName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Staff.countDocuments(filter)
    ]);

    return paginatedResponse(res, 'Staff list retrieved', staffList, { total, page, limit });
  } catch (error) {
    next(error);
  }
};

export const getStaffById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const staff = await Staff.findOne({ _id: id, schoolId: req.schoolId })
      .populate('assignedClasses.classId', 'name level arms subjects')
      .populate('userId', 'email role isActive lastLogin');

    if (!staff) {
      return errorResponse(res, 'Staff record not found', 404);
    }

    return successResponse(res, 'Staff profile retrieved', { staff });
  } catch (error) {
    next(error);
  }
};

export const registerStaff = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      phone,
      dateOfBirth,
      gender,
      address,
      emergencyContact,
      employmentDate,
      employmentType,
      department,
      designation,
      role,
      assignedClasses,
      qualifications,
      createLoginAccount,
      password
    } = req.body;

    // Check if email already in use
    const existingStaff = await Staff.findOne({
      schoolId: req.schoolId,
      email: email.toLowerCase().trim()
    });

    if (existingStaff) {
      return errorResponse(res, 'A staff member with this email already exists.', 409);
    }

    // Handle passport photo
    let passportPhoto = { url: '', publicId: '' };
    if (req.file) {
      passportPhoto = await uploadImage(req.file.buffer, req.file.mimetype, 'staff');
    } else if (req.body.passportPhotoUrl) {
      passportPhoto = { url: req.body.passportPhotoUrl, publicId: '' };
    }

    // Generate unique staff ID
    const staffId = await generateStaffId(req.schoolId);

    // Create user login account if requested or default true
    let userDoc = null;
    const shouldCreateUser = createLoginAccount !== false;

    if (shouldCreateUser) {
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingUser) {
        return errorResponse(res, 'A login account with this email already exists.', 409);
      }

      userDoc = await User.create({
        schoolId: req.schoolId,
        fullName,
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        password: password || 'SchoolMag2026!',
        role: role || 'CLASS_TEACHER',
        isActive: true
      });
    }

    // Create staff document
    const staff = await Staff.create({
      schoolId: req.schoolId,
      staffId,
      userId: userDoc ? userDoc._id : null,
      fullName,
      passportPhoto,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender,
      phone: phone.trim(),
      email: email.toLowerCase().trim(),
      address: address || '',
      emergencyContact: emergencyContact || {},
      employmentDate: employmentDate ? new Date(employmentDate) : new Date(),
      employmentType: employmentType || 'FULL_TIME',
      department: department || 'Academic',
      designation: designation || 'Teacher',
      role: role || 'CLASS_TEACHER',
      assignedClasses: assignedClasses || [],
      qualifications: qualifications || []
    });

    if (userDoc) {
      userDoc.staffProfileId = staff._id;
      await userDoc.save();
    }

    await logAudit({
      schoolId: req.schoolId,
      userId: req.user._id,
      action: 'STAFF_REGISTERED',
      entity: 'Staff',
      entityId: staff._id,
      details: { staffId: staff.staffId, fullName: staff.fullName, role: staff.role },
      req
    });

    const populated = await Staff.findById(staff._id)
      .populate('assignedClasses.classId', 'name level')
      .populate('userId', 'email role isActive');

    return successResponse(
      res,
      `Staff ${staff.fullName} registered successfully with ID: ${staff.staffId}`,
      { staff: populated },
      201
    );
  } catch (error) {
    next(error);
  }
};

export const updateStaff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const staff = await Staff.findOne({ _id: id, schoolId: req.schoolId });
    if (!staff) {
      return errorResponse(res, 'Staff record not found', 404);
    }

    if (req.file) {
      if (staff.passportPhoto?.publicId) {
        await deleteImage(staff.passportPhoto.publicId);
      }
      staff.passportPhoto = await uploadImage(req.file.buffer, req.file.mimetype, 'staff');
    }

    const updatableFields = [
      'fullName', 'phone', 'address', 'employmentType', 'department',
      'designation', 'role', 'status', 'assignedClasses', 'qualifications'
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        staff[field] = req.body[field];
      }
    });

    if (req.body.emergencyContact) {
      staff.emergencyContact = { ...staff.emergencyContact, ...req.body.emergencyContact };
    }

    await staff.save();

    // Sync role with User account if role changed
    if (req.body.role && staff.userId) {
      await User.findByIdAndUpdate(staff.userId, { role: req.body.role });
    }

    await logAudit({
      schoolId: req.schoolId,
      userId: req.user._id,
      action: 'STAFF_UPDATED',
      entity: 'Staff',
      entityId: staff._id,
      details: { staffId: staff.staffId, updatedFields: Object.keys(req.body) },
      req
    });

    const populated = await Staff.findById(staff._id)
      .populate('assignedClasses.classId', 'name level arms')
      .populate('userId', 'email role isActive');

    return successResponse(res, 'Staff profile updated successfully', { staff: populated });
  } catch (error) {
    next(error);
  }
};
