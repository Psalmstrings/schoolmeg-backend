import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Class } from '../src/models/Class.js';
import { Student } from '../src/models/Student.js';
import { Guardian } from '../src/models/Guardian.js';
import { FeeAssessment } from '../src/models/FeeAssessment.js';
import { PaymentTransaction } from '../src/models/PaymentTransaction.js';

describe('Stage 7: Student Financial Records & Accounting', () => {
  let schoolId;
  let adminToken;
  let accountantToken;
  let parentToken;
  let otherParentToken;
  let classRecord;
  let student1;
  let studentOther;
  let guardian1;
  let guardian2;

  beforeEach(async () => {
    // 1. Setup School & Admin
    const setupRes = await request(app)
      .post('/api/v1/auth/register-admin')
      .send({
        school: {
          name: 'Corona Secondary School Agbara',
          code: 'CSSA',
          schoolType: 'SECONDARY',
          email: 'admin@coronaschools.org',
          phone: '+2348022334455',
          state: 'Ogun',
          address: 'Agbara Industrial Estate, Ogun State',
          currentSession: '2025/2026',
          currentTerm: 'First Term'
        },
        admin: {
          fullName: 'Bursar General',
          email: 'bursar@coronaschools.org',
          password: 'AdminPassword123!',
          phone: '+2348022334455'
        }
      });

    adminToken = setupRes.body.data.token;
    schoolId = setupRes.body.data.school._id;

    // 2. Create Accountant
    const accountantUser = await User.create({
      schoolId,
      fullName: 'Mr. Kenneth Okonkwo',
      email: 'kenneth@coronaschools.org',
      password: 'AccountantPassword123!',
      role: 'ACCOUNTANT',
      isActive: true
    });

    const accRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'kenneth@coronaschools.org', password: 'AccountantPassword123!' });
    accountantToken = accRes.body.data.token;

    // 3. Create Parent 1 & Guardian 1
    const parentUser = await User.create({
      schoolId,
      fullName: 'Chief Femi Otedola',
      email: 'femi@example.com',
      phone: '+2348035556677',
      password: 'ParentPassword123!',
      role: 'PARENT',
      isActive: true
    });

    guardian1 = await Guardian.create({
      schoolId,
      fullName: 'Chief Femi Otedola',
      phone: '+2348035556677',
      email: 'femi@example.com',
      userId: parentUser._id
    });

    const p1Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'femi@example.com', password: 'ParentPassword123!' });
    parentToken = p1Res.body.data.token;

    // 4. Create Parent 2 & Guardian 2
    const otherUser = await User.create({
      schoolId,
      fullName: 'Dr. Stella Adadevoh',
      email: 'stella@example.com',
      phone: '+2348077778899',
      password: 'ParentPassword123!',
      role: 'PARENT',
      isActive: true
    });

    guardian2 = await Guardian.create({
      schoolId,
      fullName: 'Dr. Stella Adadevoh',
      phone: '+2348077778899',
      email: 'stella@example.com',
      userId: otherUser._id
    });

    const p2Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'stella@example.com', password: 'ParentPassword123!' });
    otherParentToken = p2Res.body.data.token;

    // 5. Create Class
    classRecord = await Class.create({
      schoolId,
      name: 'JSS 3',
      level: 'JSS',
      category: 'SECONDARY',
      orderIndex: 3,
      arms: ['A', 'B']
    });

    // 6. Create Student 1 (Ward of Chief Femi Otedola)
    student1 = await Student.create({
      schoolId,
      admissionNumber: 'CSSA/2026/0001',
      firstName: 'Temi',
      surname: 'Otedola',
      gender: 'Female',
      dateOfBirth: new Date('2011-03-20'),
      homeAddress: 'Ikoyi Crescent, Lagos',
      currentClass: classRecord._id,
      currentArm: 'A',
      admissionSession: '2025/2026',
      primaryGuardian: guardian1._id,
      status: 'ACTIVE'
    });
    guardian1.wards = [student1._id];
    await guardian1.save();

    // 7. Create Student 2 (Ward of Dr. Stella Adadevoh)
    studentOther = await Student.create({
      schoolId,
      admissionNumber: 'CSSA/2026/0002',
      firstName: 'Bankole',
      surname: 'Adadevoh',
      gender: 'Male',
      dateOfBirth: new Date('2011-07-15'),
      homeAddress: 'Yaba, Lagos',
      currentClass: classRecord._id,
      currentArm: 'B',
      admissionSession: '2025/2026',
      primaryGuardian: guardian2._id,
      status: 'ACTIVE'
    });
    guardian2.wards = [studentOther._id];
    await guardian2.save();
  });

  it('retrieves and auto-seeds standard Nigerian school fee categories', async () => {
    const res = await request(app)
      .get('/api/v1/finance/categories')
      .set('Authorization', `Bearer ${accountantToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.categories.length).toBeGreaterThanOrEqual(4);
    const categoryNames = res.body.data.categories.map((c) => c.name);
    expect(categoryNames).toContain('Tuition Fee');
    expect(categoryNames).toContain('Development Levy');
  });

  it('generates class fee assessments with integer kobo accounting', async () => {
    // ₦180,000 = 18,000,000 kobo
    const totalAmountKobo = 18000000;

    const res = await request(app)
      .post('/api/v1/finance/assess-class')
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({
        classId: classRecord._id.toString(),
        arm: 'ALL',
        session: '2025/2026',
        term: 'First Term',
        items: [
          { name: 'Tuition Fee', amountKobo: 15000000 },
          { name: 'Development Levy', amountKobo: 3000000 }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.count).toBe(2); // Both students assessed

    // Check database assessment for student1
    const assessment = await FeeAssessment.findOne({ studentId: student1._id });
    expect(assessment.netAmountKobo).toBe(totalAmountKobo);
    expect(assessment.paidAmountKobo).toBe(0);
    expect(assessment.balanceKobo).toBe(totalAmountKobo);
    expect(assessment.status).toBe('UNPAID');
  });

  it('records partial payment and updates remaining balance accurately in kobo', async () => {
    // Assess student1 first
    const assessment = await FeeAssessment.create({
      schoolId,
      studentId: student1._id,
      classId: classRecord._id,
      arm: 'A',
      academicSession: '2025/2026',
      term: 'First Term',
      items: [{ name: 'Tuition', amountKobo: 20000000 }], // ₦200,000
      totalAmountKobo: 20000000,
      netAmountKobo: 20000000,
      paidAmountKobo: 0,
      balanceKobo: 20000000,
      status: 'UNPAID'
    });

    // Record partial payment of ₦120,000 (12,000,000 kobo)
    const payRes = await request(app)
      .post('/api/v1/finance/pay')
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({
        assessmentId: assessment._id.toString(),
        amountPaidKobo: 12000000,
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'GTB/NIP/20260991',
        notes: 'First installment paid by father'
      });

    expect(payRes.status).toBe(201);
    expect(payRes.body.success).toBe(true);
    expect(payRes.body.data.transaction.receiptNumber).toMatch(/^REC-CSSA-/);
    expect(payRes.body.data.assessment.status).toBe('PARTIAL');
    expect(payRes.body.data.assessment.paidAmountKobo).toBe(12000000);
    expect(payRes.body.data.assessment.balanceKobo).toBe(8000000); // ₦80,000 remaining

    // Record final settlement payment of remaining ₦80,000 (8,000,000 kobo)
    const settleRes = await request(app)
      .post('/api/v1/finance/pay')
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({
        assessmentId: assessment._id.toString(),
        amountPaidKobo: 8000000,
        paymentMethod: 'POS',
        referenceNumber: 'POS-AUTH-882190',
        notes: 'Final settlement paid via POS terminal'
      });

    expect(settleRes.status).toBe(201);
    expect(settleRes.body.data.assessment.status).toBe('PAID');
    expect(settleRes.body.data.assessment.paidAmountKobo).toBe(20000000);
    expect(settleRes.body.data.assessment.balanceKobo).toBe(0);
  });

  it('allows parent to view financial ledger and receipts for their child, but denies unauthorized child', async () => {
    // Create assessment and payment for Student 1
    const assessment = await FeeAssessment.create({
      schoolId,
      studentId: student1._id,
      classId: classRecord._id,
      arm: 'A',
      academicSession: '2025/2026',
      term: 'First Term',
      items: [{ name: 'Tuition', amountKobo: 10000000 }],
      totalAmountKobo: 10000000,
      netAmountKobo: 10000000,
      paidAmountKobo: 10000000,
      balanceKobo: 0,
      status: 'PAID'
    });

    await PaymentTransaction.create({
      schoolId,
      studentId: student1._id,
      assessmentId: assessment._id,
      receiptNumber: 'REC-CSSA-2026-0001',
      amountPaidKobo: 10000000,
      paymentMethod: 'BANK_TRANSFER',
      receivedBy: schoolId, // dummy id
      paymentDate: new Date()
    });

    // Parent 1 views their ward's ledger -> SUCCESS
    const parentViewRes = await request(app)
      .get(`/api/v1/finance/student/${student1._id}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(parentViewRes.status).toBe(200);
    expect(parentViewRes.body.success).toBe(true);
    expect(parentViewRes.body.data.student.admissionNumber).toBe('CSSA/2026/0001');
    expect(parentViewRes.body.data.summary.status).toBe('FULLY_PAID');
    expect(parentViewRes.body.data.transactions).toHaveLength(1);

    // Parent 1 attempts to access Student Other (Dr. Stella's child) -> 403 Forbidden
    const unauthRes = await request(app)
      .get(`/api/v1/finance/student/${studentOther._id}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(unauthRes.status).toBe(403);
    expect(unauthRes.body.success).toBe(false);
  });
});
