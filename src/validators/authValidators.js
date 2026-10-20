import { z } from 'zod';
import { SCHOOL_TYPES } from '../config/constants.js';

export const registerAdminSchema = {
  body: z.object({
    school: z.object({
      name: z.string().min(3, 'School name must be at least 3 characters').max(150),
      code: z.string().min(2, 'School code must be at least 2 characters').max(10).toUpperCase(),
      schoolType: z.enum(Object.values(SCHOOL_TYPES)).default(SCHOOL_TYPES.COMBINED),
      email: z.string().email('Valid school email is required'),
      phone: z.string().min(7, 'School phone number is required'),
      state: z.string().min(2, 'State is required'),
      lga: z.string().optional().default(''),
      address: z.string().optional().default(''),
      currentSession: z.string().default('2025/2026'),
      currentTerm: z.enum(['First Term', 'Second Term', 'Third Term']).default('First Term')
    }),
    admin: z.object({
      fullName: z.string().min(3, 'Admin full name must be at least 3 characters'),
      email: z.string().email('Valid administrator email is required'),
      password: z.string().min(6, 'Password must be at least 6 characters'),
      phone: z.string().optional().default('')
    })
  })
};

export const loginSchema = {
  body: z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required')
  })
};

export const forgotPasswordSchema = {
  body: z.object({
    email: z.string().email('Please provide a valid email')
  })
};

export const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: z.string().min(6, 'Password must be at least 6 characters')
  })
};
