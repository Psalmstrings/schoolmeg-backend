import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import schoolRoutes from './routes/schoolRoutes.js';
import auditLogRoutes from './routes/auditLogRoutes.js';
import classRoutes from './routes/classRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import idCardRoutes from './routes/idCardRoutes.js';
import gateAttendanceRoutes from './routes/gateAttendanceRoutes.js';
import classroomAttendanceRoutes from './routes/classroomAttendanceRoutes.js';
import parentRoutes from './routes/parentRoutes.js';
import resultRoutes from './routes/resultRoutes.js';
import financeRoutes from './routes/financeRoutes.js';

const app = express();

// Security HTTP headers
app.use(helmet());

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow localhost and specified frontend url
      if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin === config.frontendUrl) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev/testing, production uses config.frontendUrl
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiter to all API routes except in test environment
if (config.env !== 'test') {
  app.use('/api', limiter);
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: config.env
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/schools', schoolRoutes);
app.use('/api/v1/audit-logs', auditLogRoutes);
app.use('/api/v1/classes', classRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/id-cards', idCardRoutes);
app.use('/api/v1/attendance/gate', gateAttendanceRoutes);
app.use('/api/v1/attendance/classroom', classroomAttendanceRoutes);
app.use('/api/v1/parent', parentRoutes);
app.use('/api/v1/results', resultRoutes);
app.use('/api/v1/finance', financeRoutes);

// Catch-all 404 handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

export default app;
