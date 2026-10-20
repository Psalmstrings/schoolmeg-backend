import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Class } from '../src/models/Class.js';
import { Student } from '../src/models/Student.js';
import { Guardian } from '../src/models/Guardian.js';
import { GateAttendanceEvent } from '../src/models/GateAttendanceEvent.js';
import { ClassroomAttendanceSession } from '../src/models/ClassroomAttendanceSession.js';
import { ClassroomAttendanceRecord } from '../src/models/ClassroomAttendanceRecord.js';
import { issueStudentCard } from '../src/services/idCardService.js';

describe('Stage 5: Parent Portal, Child Linkage & Attendance Visibility', () => {
  let schoolId;
  let parentToken;
  let otherParentToken;
  let teacherToken;
  let guardian1;
  let guardian2;
  let student1;
  let student2; // sibling of student1
  let studentOther; // ward of guardian2
  let class1;

  beforeEach(async () => {
    // 1. Setup School & Admin
    const setupRes = await request(app)
      .post('/api/v1/auth/register-admin')
      .send({
        school: {
          name: 'Crown Heights College',
          code: 'CHC',
          schoolType: 'SECONDARY',
          email: 'admin@crownheights.edu.ng',
          phone: '+2348011223344',
          state: 'Ogun',
          address: 'Abeokuta, Ogun State',
          currentSession: '2025/2026',
          currentTerm: 'First Term'
        },
        admin: {
          fullName: 'Principal Johnson',
          email: 'principal@crownheights.edu.ng',
          password: 'AdminPassword123!',
          phone: '+2348011223344'
        }
      });

    schoolId = setupRes.body.data.school._id;

    // 2. Create Parent 1 User & Guardian
    const parentUser = await User.create({
      schoolId,
      fullName: 'Alhaji Musa Danjuma',
      email: 'musa@example.com',
      phone: '+2348039988776',
      password: 'ParentPassword123!',
      role: 'PARENT',
      isActive: true
    });

    guardian1 = await Guardian.create({
      schoolId,
      fullName: 'Alhaji Musa Danjuma',
      phone: '+2348039988776',
      email: 'musa@example.com',
      relationship: 'Father',
      userId: parentUser._id
    });

    // 3. Create Parent 2 User & Guardian (Unrelated)
    const otherParentUser = await User.create({
      schoolId,
      fullName: 'Mrs. Chioma Okafor',
      email: 'chioma@example.com',
      phone: '+2348022223333',
      password: 'ParentPassword123!',
      role: 'PARENT',
      isActive: true
    });

    guardian2 = await Guardian.create({
      schoolId,
      fullName: 'Mrs. Chioma Okafor',
      phone: '+2348022223333',
      email: 'chioma@example.com',
      relationship: 'Mother',
      userId: otherParentUser._id
    });

    // 4. Create Teacher
    const teacher = await User.create({
      schoolId,
      fullName: 'Mr. David Adeleke',
      email: 'david@crownheights.edu.ng',
      password: 'TeacherPassword123!',
      role: 'CLASS_TEACHER',
      isActive: true
    });

    // Login tokens
    const p1Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'musa@example.com', password: 'ParentPassword123!' });
    parentToken = p1Res.body.data.token;

    const p2Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'chioma@example.com', password: 'ParentPassword123!' });
    otherParentToken = p2Res.body.data.token;

    const tRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'david@crownheights.edu.ng', password: 'TeacherPassword123!' });
    teacherToken = tRes.body.data.token;

    // 5. Create Class
    class1 = await Class.create({
      schoolId,
      name: 'SS 1',
      level: 'SSS',
      category: 'SECONDARY',
      orderIndex: 4,
      arms: ['A', 'B'],
      classTeacherId: teacher._id
    });

    // 6. Register Student 1 (Ward of Guardian 1)
    student1 = await Student.create({
      schoolId,
      admissionNumber: 'CHC/2026/0001',
      firstName: 'Zainab',
      surname: 'Danjuma',
      gender: 'Female',
      dateOfBirth: new Date('2010-04-15'),
      homeAddress: 'Plot 4, Ibara Housing Estate',
      currentClass: class1._id,
      currentArm: 'A',
      admissionSession: '2025/2026',
      primaryGuardian: guardian1._id,
      status: 'ACTIVE'
    });

    // 7. Register Student 2 (Sibling - Also Ward of Guardian 1)
    student2 = await Student.create({
      schoolId,
      admissionNumber: 'CHC/2026/0002',
      firstName: 'Ibrahim',
      surname: 'Danjuma',
      gender: 'Male',
      dateOfBirth: new Date('2012-09-22'),
      homeAddress: 'Plot 4, Ibara Housing Estate',
      currentClass: class1._id,
      currentArm: 'A',
      admissionSession: '2025/2026',
      primaryGuardian: guardian1._id,
      status: 'ACTIVE'
    });

    // Link wards to guardian1
    guardian1.wards = [student1._id, student2._id];
    await guardian1.save();

    // 8. Register Student Other (Ward of Guardian 2)
    studentOther = await Student.create({
      schoolId,
      admissionNumber: 'CHC/2026/0003',
      firstName: 'Somto',
      surname: 'Okafor',
      gender: 'Male',
      dateOfBirth: new Date('2011-01-10'),
      homeAddress: '12 Oke-Mosan Way',
      currentClass: class1._id,
      currentArm: 'B',
      admissionSession: '2025/2026',
      primaryGuardian: guardian2._id,
      status: 'ACTIVE'
    });
    guardian2.wards = [studentOther._id];
    await guardian2.save();

    // Issue cards
    const card1 = await issueStudentCard(student1._id, schoolId);

    // 9. Generate Gate Movement Events for Student 1
    await GateAttendanceEvent.create({
      schoolId,
      holderType: 'STUDENT',
      studentId: student1._id,
      idCardId: card1._id,
      eventType: 'ENTRY',
      date: '2026-10-20',
      timestamp: new Date('2026-10-20T07:45:00Z'),
      operatorId: teacher._id,
      isLate: false,
      status: 'PRESENT_ON_CAMPUS'
    });

    await GateAttendanceEvent.create({
      schoolId,
      holderType: 'STUDENT',
      studentId: student1._id,
      idCardId: card1._id,
      eventType: 'EXIT',
      date: '2026-10-20',
      timestamp: new Date('2026-10-20T14:30:00Z'),
      operatorId: teacher._id,
      isLate: false,
      status: 'EXITED_CAMPUS'
    });

    // 10. Generate Classroom Attendance Record for Student 1
    const session = await ClassroomAttendanceSession.create({
      schoolId,
      classId: class1._id,
      arm: 'A',
      subject: 'Physics',
      date: '2026-10-20',
      session: '2025/2026',
      term: 'First Term',
      teacherId: teacher._id,
      status: 'OPEN'
    });

    await ClassroomAttendanceRecord.create({
      schoolId,
      sessionId: session._id,
      studentId: student1._id,
      status: 'PRESENT',
      method: 'QR_SCAN',
      markedBy: teacher._id,
      scannedAt: new Date()
    });
  });

  it('retrieves all wards linked to the authenticated guardian (including siblings)', async () => {
    const res = await request(app)
      .get('/api/v1/parent/children')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.children).toHaveLength(2);
    const names = res.body.data.children.map((c) => c.firstName);
    expect(names).toContain('Zainab');
    expect(names).toContain('Ibrahim');
    expect(names).not.toContain('Somto'); // Somto belongs to Mrs. Okafor
  });

  it('retrieves gate movement history and punctuality statistics for a linked child', async () => {
    const res = await request(app)
      .get(`/api/v1/parent/children/${student1._id}/attendance/gate`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.student.admissionNumber).toBe('CHC/2026/0001');
    expect(res.body.data.events).toHaveLength(2);
    expect(res.body.data.stats.totalDaysRecorded).toBe(1);
    expect(res.body.data.stats.onTimeArrivals).toBe(1);
    expect(res.body.data.stats.punctualityRate).toBe(100);
  });

  it('retrieves classroom attendance history and attendance rate for a linked child', async () => {
    const res = await request(app)
      .get(`/api/v1/parent/children/${student1._id}/attendance/classroom`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.records).toHaveLength(1);
    expect(res.body.data.records[0].status).toBe('PRESENT');
    expect(res.body.data.stats.attendanceRate).toBe(100);
  });

  it('strictly forbids a parent from accessing another parent’s child records', async () => {
    // Parent 1 attempts to access Student Other (Mrs. Okafor's child)
    const res = await request(app)
      .get(`/api/v1/parent/children/${studentOther._id}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Access denied');
  });

  it('strictly forbids a parent from accessing gate attendance of an unrelated student', async () => {
    const res = await request(app)
      .get(`/api/v1/parent/children/${studentOther._id}/attendance/gate`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
