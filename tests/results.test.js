import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Class } from '../src/models/Class.js';
import { Student } from '../src/models/Student.js';
import { Guardian } from '../src/models/Guardian.js';
import { SubjectResult } from '../src/models/SubjectResult.js';
import { ReportCard } from '../src/models/ReportCard.js';

describe('Stage 6: Class Results, Auto Calculations, Grading & Report Cards', () => {
  let schoolId;
  let adminToken;
  let teacherToken;
  let parentToken;
  let otherParentToken;
  let classRecord;
  let student1;
  let student2;
  let studentOther;
  let guardian1;
  let guardian2;

  beforeEach(async () => {
    // 1. Setup School & Admin
    const setupRes = await request(app)
      .post('/api/v1/auth/register-admin')
      .send({
        school: {
          name: 'St. Gregory Premier College Lagos',
          code: 'SGC',
          schoolType: 'SECONDARY',
          email: 'admin@stgregory.edu.ng',
          phone: '+2348011223344',
          state: 'Lagos',
          address: 'Ikoyi, Lagos',
          currentSession: '2025/2026',
          currentTerm: 'First Term'
        },
        admin: {
          fullName: 'Rev. Father Principal',
          email: 'principal@stgregory.edu.ng',
          password: 'PrincipalPassword123!',
          phone: '+2348011223344'
        }
      });

    adminToken = setupRes.body.data.token;
    schoolId = setupRes.body.data.school._id;

    // 2. Create Teacher
    const teacher = await User.create({
      schoolId,
      fullName: 'Mr. Babatunde Fashola',
      email: 'babatunde@stgregory.edu.ng',
      password: 'TeacherPassword123!',
      role: 'CLASS_TEACHER',
      isActive: true
    });

    const teacherRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'babatunde@stgregory.edu.ng', password: 'TeacherPassword123!' });
    teacherToken = teacherRes.body.data.token;

    // 3. Create Class
    classRecord = await Class.create({
      schoolId,
      name: 'SS 2',
      level: 'SSS',
      category: 'SECONDARY',
      orderIndex: 5,
      arms: ['A', 'B'],
      subjects: ['Mathematics', 'English Language', 'Physics'],
      classTeacherId: teacher._id
    });

    // 4. Create Parent & Guardian
    const parentUser = await User.create({
      schoolId,
      fullName: 'Chief Adeleke',
      email: 'adeleke@example.com',
      phone: '+2348031112233',
      password: 'ParentPassword123!',
      role: 'PARENT',
      isActive: true
    });

    guardian1 = await Guardian.create({
      schoolId,
      fullName: 'Chief Adeleke',
      phone: '+2348031112233',
      email: 'adeleke@example.com',
      userId: parentUser._id
    });

    const parentRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'adeleke@example.com', password: 'ParentPassword123!' });
    parentToken = parentRes.body.data.token;

    // 5. Create Other Parent
    const otherParentUser = await User.create({
      schoolId,
      fullName: 'Dr. Chike Obi',
      email: 'chike@example.com',
      phone: '+2348099998877',
      password: 'ParentPassword123!',
      role: 'PARENT',
      isActive: true
    });

    guardian2 = await Guardian.create({
      schoolId,
      fullName: 'Dr. Chike Obi',
      phone: '+2348099998877',
      email: 'chike@example.com',
      userId: otherParentUser._id
    });

    const otherParentRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'chike@example.com', password: 'ParentPassword123!' });
    otherParentToken = otherParentRes.body.data.token;

    // 6. Create Student 1 (High Scorer - Ward of Chief Adeleke)
    student1 = await Student.create({
      schoolId,
      admissionNumber: 'SGC/2026/0001',
      firstName: 'David',
      surname: 'Adeleke',
      gender: 'Male',
      dateOfBirth: new Date('2009-11-21'),
      homeAddress: '1 Banana Island Rd, Ikoyi',
      currentClass: classRecord._id,
      currentArm: 'A',
      admissionSession: '2025/2026',
      primaryGuardian: guardian1._id,
      status: 'ACTIVE'
    });
    guardian1.wards = [student1._id];
    await guardian1.save();

    // 7. Create Student 2 (Average Scorer - Same Class Arm)
    student2 = await Student.create({
      schoolId,
      admissionNumber: 'SGC/2026/0002',
      firstName: 'Tiwa',
      surname: 'Savage',
      gender: 'Female',
      dateOfBirth: new Date('2009-02-05'),
      homeAddress: '25 Parkview Estate, Ikoyi',
      currentClass: classRecord._id,
      currentArm: 'A',
      admissionSession: '2025/2026',
      primaryGuardian: guardian1._id,
      status: 'ACTIVE'
    });

    // 8. Create Student Other (Ward of Dr. Chike Obi in Arm B)
    studentOther = await Student.create({
      schoolId,
      admissionNumber: 'SGC/2026/0003',
      firstName: 'Chidera',
      surname: 'Obi',
      gender: 'Female',
      dateOfBirth: new Date('2009-06-14'),
      homeAddress: '8 Lekki Phase 1',
      currentClass: classRecord._id,
      currentArm: 'B',
      admissionSession: '2025/2026',
      primaryGuardian: guardian2._id,
      status: 'ACTIVE'
    });
    guardian2.wards = [studentOther._id];
    await guardian2.save();
  });

  it('loads the empty subject score sheet for a class arm and subject', async () => {
    const res = await request(app)
      .get('/api/v1/results/score-sheet')
      .set('Authorization', `Bearer ${teacherToken}`)
      .query({
        classId: classRecord._id.toString(),
        arm: 'A',
        subject: 'Mathematics',
        session: '2025/2026',
        term: 'First Term'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.studentsCount).toBe(2);
    expect(res.body.data.scoreSheet).toHaveLength(2);
    expect(res.body.data.scoreSheet[0].caScore).toBe(0);
    expect(res.body.data.scoreSheet[0].status).toBe('NOT_ENTERED');
  });

  it('records scores, automatically calculates total, grade, remark, and saves as draft', async () => {
    const records = [
      {
        studentId: student1._id.toString(),
        caScore: 36, // Max 40
        examScore: 54, // Max 60 -> Total = 90
        teacherRemarks: 'Brilliant mathematical understanding.'
      },
      {
        studentId: student2._id.toString(),
        caScore: 22,
        examScore: 30, // Total = 52 -> Grade C Credit
        teacherRemarks: 'Satisfactory performance.'
      }
    ];

    const saveRes = await request(app)
      .post('/api/v1/results/batch-save')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        classId: classRecord._id.toString(),
        arm: 'A',
        subject: 'Mathematics',
        session: '2025/2026',
        term: 'First Term',
        records,
        submit: false
      });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.success).toBe(true);
    expect(saveRes.body.data.status).toBe('DRAFT');

    // Verify calculated records in database
    const dbRes1 = await SubjectResult.findOne({
      schoolId,
      studentId: student1._id,
      subject: 'Mathematics'
    });
    expect(dbRes1.totalScore).toBe(90);
    expect(dbRes1.grade).toBe('A');
    expect(dbRes1.remark).toBe('Excellent');

    const dbRes2 = await SubjectResult.findOne({
      schoolId,
      studentId: student2._id,
      subject: 'Mathematics'
    });
    expect(dbRes2.totalScore).toBe(52);
    expect(dbRes2.grade).toBe('C');
    expect(dbRes2.remark).toBe('Credit');
  });

  it('allows teacher to submit completed scores for administrative approval', async () => {
    const records = [
      {
        studentId: student1._id.toString(),
        caScore: 35,
        examScore: 50
      }
    ];

    const submitRes = await request(app)
      .post('/api/v1/results/batch-save')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        classId: classRecord._id.toString(),
        arm: 'A',
        subject: 'Mathematics',
        session: '2025/2026',
        term: 'First Term',
        records,
        submit: true
      });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe('SUBMITTED');

    const dbRecord = await SubjectResult.findOne({ studentId: student1._id });
    expect(dbRecord.status).toBe('SUBMITTED');
    expect(dbRecord.submittedAt).toBeDefined();
  });

  it('compiles, ranks, and publishes terminal report cards with position calculation', async () => {
    // 1. Enter and save Mathematics results
    await request(app)
      .post('/api/v1/results/batch-save')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        classId: classRecord._id.toString(),
        arm: 'A',
        subject: 'Mathematics',
        session: '2025/2026',
        term: 'First Term',
        records: [
          { studentId: student1._id.toString(), caScore: 38, examScore: 57 }, // 95
          { studentId: student2._id.toString(), caScore: 20, examScore: 25 } // 45
        ],
        submit: true
      });

    // 2. Enter and save English Language results
    await request(app)
      .post('/api/v1/results/batch-save')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        classId: classRecord._id.toString(),
        arm: 'A',
        subject: 'English Language',
        session: '2025/2026',
        term: 'First Term',
        records: [
          { studentId: student1._id.toString(), caScore: 35, examScore: 50 }, // 85
          { studentId: student2._id.toString(), caScore: 25, examScore: 35 } // 60
        ],
        submit: true
      });

    // 3. School Admin publishes class report cards
    const pubRes = await request(app)
      .post('/api/v1/results/publish')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        classId: classRecord._id.toString(),
        arm: 'A',
        session: '2025/2026',
        term: 'First Term'
      });

    expect(pubRes.status).toBe(200);
    expect(pubRes.body.success).toBe(true);

    // 4. Verify Student 1 (David Adeleke) is Ranked #1 (1st)
    const report1 = await ReportCard.findOne({ studentId: student1._id });
    expect(report1.status).toBe('PUBLISHED');
    expect(report1.summary.averageScore).toBe(90); // (95 + 85) / 2
    expect(report1.summary.positionInClass).toBe(1);
    expect(report1.summary.totalStudentsInClass).toBe(2);

    // 5. Verify Student 2 (Tiwa Savage) is Ranked #2 (2nd)
    const report2 = await ReportCard.findOne({ studentId: student2._id });
    expect(report2.status).toBe('PUBLISHED');
    expect(report2.summary.averageScore).toBe(52.5); // (45 + 60) / 2
    expect(report2.summary.positionInClass).toBe(2);
  });

  it('allows parent to view published report card for their child, but denies unauthorized child', async () => {
    // Publish report cards first
    await request(app)
      .post('/api/v1/results/batch-save')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        classId: classRecord._id.toString(),
        arm: 'A',
        subject: 'Mathematics',
        session: '2025/2026',
        term: 'First Term',
        records: [{ studentId: student1._id.toString(), caScore: 38, examScore: 52 }],
        submit: true
      });

    await request(app)
      .post('/api/v1/results/publish')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        classId: classRecord._id.toString(),
        arm: 'A',
        session: '2025/2026',
        term: 'First Term'
      });

    // Parent 1 views their ward's published report card -> SUCCESS
    const viewRes = await request(app)
      .get(`/api/v1/results/report-card/${student1._id}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .query({ session: '2025/2026', term: 'First Term' });

    expect(viewRes.status).toBe(200);
    expect(viewRes.body.success).toBe(true);
    expect(viewRes.body.data.student.fullName).toBe('Adeleke David');
    expect(viewRes.body.data.reportCard.status).toBe('PUBLISHED');

    // Parent 1 attempts to view unauthorized child (Dr. Chike's child) -> 403 Forbidden
    const unauthRes = await request(app)
      .get(`/api/v1/results/report-card/${studentOther._id}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .query({ session: '2025/2026', term: 'First Term' });

    expect(unauthRes.status).toBe(403);
    expect(unauthRes.body.success).toBe(false);
  });
});
