import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { School } from '../src/models/School.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { USER_ROLES } from '../src/config/constants.js';

describe('Stage 1: School Setup, Authentication & Role Authorization', () => {
  const validPayload = {
    school: {
      name: 'Bright Future Academy Lagos',
      code: 'BFA',
      schoolType: 'COMBINED',
      email: 'admin@brightfuture.edu.ng',
      phone: '+2348012345678',
      state: 'Lagos',
      lga: 'Ikeja',
      address: '12 Education Avenue, Ikeja',
      currentSession: '2025/2026',
      currentTerm: 'First Term'
    },
    admin: {
      fullName: 'Adebayo Ogunlesi',
      email: 'principal@brightfuture.edu.ng',
      password: 'AdminPassword123!',
      phone: '+2348012345678'
    }
  };

  it('registers a new school and administrator successfully', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register-admin')
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.school.name).toBe('Bright Future Academy Lagos');
    expect(res.body.data.school.code).toBe('BFA');
    expect(res.body.data.user.email).toBe('principal@brightfuture.edu.ng');
    expect(res.body.data.user.role).toBe(USER_ROLES.SCHOOL_ADMIN);
    expect(res.body.data.user.password).toBeUndefined(); // ensure password hash not leaked
    expect(res.body.data.token).toBeDefined();

    // Verify audit log
    const audit = await AuditLog.findOne({ action: 'SCHOOL_INITIALIZED' });
    expect(audit).not.toBeNull();
    expect(audit.entity).toBe('School');
  });

  it('rejects duplicate school code or admin email', async () => {
    await request(app).post('/api/v1/auth/register-admin').send(validPayload);

    // Try registering again with same code
    const resDuplicate = await request(app)
      .post('/api/v1/auth/register-admin')
      .send(validPayload);

    expect(resDuplicate.status).toBe(409);
    expect(resDuplicate.body.success).toBe(false);
  });

  it('logs in successfully with valid credentials and sets token cookie', async () => {
    await request(app).post('/api/v1/auth/register-admin').send(validPayload);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'principal@brightfuture.edu.ng',
        password: 'AdminPassword123!'
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.user.fullName).toBe('Adebayo Ogunlesi');
    expect(loginRes.body.data.token).toBeDefined();

    // Verify cookie set
    const cookies = loginRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/token=/);
  });

  it('rejects login with incorrect password', async () => {
    await request(app).post('/api/v1/auth/register-admin').send(validPayload);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'principal@brightfuture.edu.ng',
        password: 'WrongPassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('retrieves current authenticated user and school profile via /me', async () => {
    const regRes = await request(app).post('/api/v1/auth/register-admin').send(validPayload);
    const token = regRes.body.data.token;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe('principal@brightfuture.edu.ng');
    expect(meRes.body.data.school.code).toBe('BFA');
  });

  it('updates school settings including attendance rules and branding', async () => {
    const regRes = await request(app).post('/api/v1/auth/register-admin').send(validPayload);
    const token = regRes.body.data.token;

    const updateRes = await request(app)
      .put('/api/v1/schools/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        attendanceRules: {
          openingTime: '07:45',
          lateThresholdTime: '08:30'
        },
        branding: {
          primaryColor: '#0f172a',
          secondaryColor: '#38bdf8'
        }
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.school.attendanceRules.lateThresholdTime).toBe('08:30');
    expect(updateRes.body.data.school.branding.primaryColor).toBe('#0f172a');
  });

  it('enforces least-privilege role boundaries on admin routes', async () => {
    const regRes = await request(app).post('/api/v1/auth/register-admin').send(validPayload);
    const schoolId = regRes.body.data.school._id;

    // Create a user with TEACHER role
    const teacherUser = await User.create({
      schoolId,
      fullName: 'Teacher Chinedu',
      email: 'teacher@brightfuture.edu.ng',
      password: 'TeacherPassword123!',
      role: USER_ROLES.CLASS_TEACHER
    });

    const teacherLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'teacher@brightfuture.edu.ng',
      password: 'TeacherPassword123!'
    });

    const teacherToken = teacherLogin.body.data.token;

    // Teacher tries to update school settings
    const forbiddenRes = await request(app)
      .put('/api/v1/schools/settings')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        branding: { primaryColor: '#ff0000' }
      });

    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.message).toMatch(/Access denied/);
  });
});
