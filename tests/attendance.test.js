import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Class } from '../src/models/Class.js';
import { Student } from '../src/models/Student.js';
import { Guardian } from '../src/models/Guardian.js';
import { issueStudentCard, revokeCard } from '../src/services/idCardService.js';

describe('Stage 4: QR Gate & Classroom Attendance Verification', () => {
  let schoolId;
  let adminToken;
  let gateOfficerToken;
  let teacherToken;
  let classA;
  let studentA;
  let studentB;
  let cardA;
  let cardB;

  beforeEach(async () => {
    // 1. Setup School & Admin via Register Admin API
    const setupRes = await request(app)
      .post('/api/v1/auth/register-admin')
      .send({
        school: {
          name: 'Grange Academy Lagos',
          code: 'GAL',
          schoolType: 'SECONDARY',
          email: 'admin@grangeacademy.ng',
          phone: '+2348011223344',
          state: 'Lagos',
          address: 'Victoria Island, Lagos',
          currentSession: '2025/2026',
          currentTerm: 'First Term'
        },
        admin: {
          fullName: 'Chief Administrator',
          email: 'admin@grangeacademy.ng',
          password: 'Password123!',
          phone: '+2348011223344'
        }
      });

    adminToken = setupRes.body.data.token;
    schoolId = setupRes.body.data.school._id;

    // 2. Create Gate Officer
    const gateOfficer = await User.create({
      schoolId,
      fullName: 'Officer Sani',
      email: 'sani@grangeacademy.ng',
      password: 'Password123!',
      role: 'GATE_OFFICER',
      isActive: true
    });

    // 3. Create Teacher
    const teacher = await User.create({
      schoolId,
      fullName: 'Mrs. Folake Adeyemi',
      email: 'folake@grangeacademy.ng',
      password: 'Password123!',
      role: 'CLASS_TEACHER',
      isActive: true
    });

    const gateRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'sani@grangeacademy.ng', password: 'Password123!' });
    gateOfficerToken = gateRes.body.data.token;

    const teacherRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'folake@grangeacademy.ng', password: 'Password123!' });
    teacherToken = teacherRes.body.data.token;

    // 4. Create Class with arms A and B
    classA = await Class.create({
      schoolId,
      name: 'JSS 1',
      level: 'JSS',
      category: 'SECONDARY',
      orderIndex: 1,
      arms: ['A', 'B'],
      classTeacherId: teacher._id
    });

    const guardian = await Guardian.create({
      schoolId,
      fullName: 'Dr. Obinna Eze',
      phone: '+2348033001122',
      email: 'obinna@example.com'
    });

    // 5. Create Student A in Arm A
    studentA = await Student.create({
      schoolId,
      admissionNumber: 'GAL/2026/0001',
      firstName: 'Chidinma',
      surname: 'Eze',
      gender: 'Female',
      dateOfBirth: new Date('2014-05-12'),
      homeAddress: '15 Adeola Odeku St, Victoria Island',
      currentClass: classA._id,
      currentArm: 'A',
      admissionSession: '2025/2026',
      primaryGuardian: guardian._id,
      status: 'ACTIVE'
    });

    // 6. Create Student B in Arm B
    studentB = await Student.create({
      schoolId,
      admissionNumber: 'GAL/2026/0002',
      firstName: 'Emeka',
      surname: 'Eze',
      gender: 'Male',
      dateOfBirth: new Date('2015-08-20'),
      homeAddress: '15 Adeola Odeku St, Victoria Island',
      currentClass: classA._id,
      currentArm: 'B',
      admissionSession: '2025/2026',
      primaryGuardian: guardian._id,
      status: 'ACTIVE'
    });

    // 7. Issue ID cards
    cardA = await issueStudentCard(studentA._id, schoolId);
    cardB = await issueStudentCard(studentB._id, schoolId);
  });

  it('records gate ENTRY event when Student A scans their institutional QR card', async () => {
    const res = await request(app)
      .post('/api/v1/attendance/gate/scan')
      .set('Authorization', `Bearer ${gateOfficerToken}`)
      .send({
        qrCodeString: cardA.qrCodeString,
        requestedEventType: 'ENTRY',
        gateName: 'Main Campus Gate'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.eventType).toBe('ENTRY');
    expect(res.body.data.holderType).toBe('STUDENT');
    expect(res.body.data.holder.fullName).toBe('Eze Chidinma');
    expect(res.body.data.holder.identifier).toBe('GAL/2026/0001');
  });

  it('records gate EXIT transition when requested or auto-toggled', async () => {
    // Record Entry first
    await request(app)
      .post('/api/v1/attendance/gate/scan')
      .set('Authorization', `Bearer ${gateOfficerToken}`)
      .send({
        qrCodeString: cardA.qrCodeString,
        requestedEventType: 'ENTRY',
        gateName: 'Main Campus Gate'
      });

    // Update previous event timestamp to 1 minute ago to bypass the 30s cooldown in test
    const { GateAttendanceEvent } = await import('../src/models/GateAttendanceEvent.js');
    await GateAttendanceEvent.updateMany({}, { $set: { timestamp: new Date(Date.now() - 60000) } });

    const res = await request(app)
      .post('/api/v1/attendance/gate/scan')
      .set('Authorization', `Bearer ${gateOfficerToken}`)
      .send({
        qrCodeString: cardA.qrCodeString,
        requestedEventType: 'EXIT',
        gateName: 'Main Campus Gate'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.eventType).toBe('EXIT');
    expect(res.body.data.campusStatus).toBe('EXITED_CAMPUS');
  });

  it('retrieves daily gate movement report and statistics', async () => {
    await request(app)
      .post('/api/v1/attendance/gate/scan')
      .set('Authorization', `Bearer ${gateOfficerToken}`)
      .send({
        qrCodeString: cardA.qrCodeString,
        requestedEventType: 'ENTRY',
        gateName: 'Main Campus Gate'
      });

    const res = await request(app)
      .get('/api/v1/attendance/gate/daily-report')
      .set('Authorization', `Bearer ${gateOfficerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalEvents).toBeGreaterThanOrEqual(1);
    expect(res.body.data.stats.totalEntries).toBeGreaterThanOrEqual(1);
  });

  it('creates classroom attendance session and marks Student A PRESENT in Arm A', async () => {
    const sessionRes = await request(app)
      .post('/api/v1/attendance/classroom/session')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        classId: classA._id.toString(),
        arm: 'A',
        subject: 'Mathematics'
      });

    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body.success).toBe(true);
    const sessionId = sessionRes.body.data.session._id;
    expect(sessionId).toBeDefined();

    const scanRes = await request(app)
      .post('/api/v1/attendance/classroom/scan')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        sessionId,
        qrCodeString: cardA.qrCodeString
      });

    expect(scanRes.status).toBe(201);
    expect(scanRes.body.success).toBe(true);
    expect(scanRes.body.data.record.status).toBe('PRESENT');
    expect(scanRes.body.data.student._id.toString()).toBe(studentA._id.toString());
  });

  it('strictly rejects Student B scanning in JSS 1 Arm A session due to arm mismatch', async () => {
    const sessionRes = await request(app)
      .post('/api/v1/attendance/classroom/session')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        classId: classA._id.toString(),
        arm: 'A',
        subject: 'Mathematics'
      });

    const sessionId = sessionRes.body.data.session._id;

    // Attempt to scan Student B (who belongs to Arm B) into Arm A session
    const scanRes = await request(app)
      .post('/api/v1/attendance/classroom/scan')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        sessionId,
        qrCodeString: cardB.qrCodeString
      });

    expect(scanRes.status).toBe(409);
    expect(scanRes.body.success).toBe(false);
    expect(scanRes.body.message).toContain('Arm B, not Arm A');
  });

  it('rejects duplicate scan of the same student within the same classroom session', async () => {
    const sessionRes = await request(app)
      .post('/api/v1/attendance/classroom/session')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        classId: classA._id.toString(),
        arm: 'A',
        subject: 'Mathematics'
      });

    const sessionId = sessionRes.body.data.session._id;

    // Scan Student A once
    await request(app)
      .post('/api/v1/attendance/classroom/scan')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        sessionId,
        qrCodeString: cardA.qrCodeString
      });

    // Scan Student A again
    const duplicateRes = await request(app)
      .post('/api/v1/attendance/classroom/scan')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        sessionId,
        qrCodeString: cardA.qrCodeString
      });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.success).toBe(false);
    expect(duplicateRes.body.message).toContain('already marked');
  });

  it('rejects attendance scanning with a revoked ID card', async () => {
    await revokeCard(cardB._id, schoolId, 'Student lost card');

    const res = await request(app)
      .post('/api/v1/attendance/gate/scan')
      .set('Authorization', `Bearer ${gateOfficerToken}`)
      .send({
        qrCodeString: cardB.qrCodeString
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('revoked');
  });
});
