import { z } from 'zod';
import { SCHOOL_TYPES } from '../config/constants.js';

export const updateSchoolProfileSchema = {
  body: z.object({
    name: z.string().min(3).max(150).optional(),
    motto: z.string().optional(),
    schoolType: z.enum(Object.values(SCHOOL_TYPES)).optional(),
    logoUrl: z.string().optional(),
    contact: z
      .object({
        email: z.string().email().optional(),
        phone: z.string().optional(),
        website: z.string().optional()
      })
      .optional(),
    address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        lga: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional()
      })
      .optional()
  })
};

export const updateSchoolSettingsSchema = {
  body: z.object({
    academicSettings: z
      .object({
        currentSession: z.string().optional(),
        currentTerm: z.enum(['First Term', 'Second Term', 'Third Term']).optional(),
        termStartDate: z.string().optional(),
        termEndDate: z.string().optional()
      })
      .optional(),
    attendanceRules: z
      .object({
        openingTime: z.string().optional(),
        closingTime: z.string().optional(),
        lateThresholdTime: z.string().optional(),
        gateScanningWindows: z
          .object({
            arrivalStart: z.string().optional(),
            arrivalEnd: z.string().optional(),
            departureStart: z.string().optional(),
            departureEnd: z.string().optional()
          })
          .optional()
      })
      .optional(),
    branding: z
      .object({
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional(),
        accentColor: z.string().optional(),
        idCardOrientation: z.enum(['portrait', 'landscape']).optional(),
        principalSignatureUrl: z.string().optional()
      })
      .optional(),
    gradingPolicy: z
      .object({
        passThreshold: z.number().min(0).max(100).optional(),
        scale: z
          .array(
            z.object({
              grade: z.string(),
              minScore: z.number(),
              maxScore: z.number(),
              description: z.string().optional(),
              gradePoint: z.number().optional()
            })
          )
          .optional(),
        assessmentComponents: z
          .array(
            z.object({
              name: z.string(),
              code: z.string(),
              maxScore: z.number().positive()
            })
          )
          .optional()
      })
      .optional()
  })
};
