import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { IDCard } from '../src/models/IDCard.js';
import { verifyQRToken } from '../src/services/idCardService.js';

describe('Stage 3: ID Card Generation, Cryptographic QR, Revocation & Reissue', () => {
  let adminToken;
  let schoolId;
  let studentId;
  let staffId;

  beforeEach(async () => {
    // Register school & admin
    const setupRes = await request(app)
      .post('/api/v1/auth/register-admin')
      .send({
        school: {
          name: 'Greenfield International School Abuja',
          code: 'GISA',
          schoolType: 'COMBINED',
          email: 'admin@greenfield.edu.ng',
          phone: '+2348033332222',
          state: 'FCT - Abuja',
          address: 'Plot 100, Maitama District',
          currentSession: '2025/2026',
          currentTerm: 'First Term'
        },
        admin: {
          fullName: 'Dr. Amina Yusuf',
          email: 'amina.yusuf@greenfield.edu.ng',
          password: 'AminaPassword2026!',
          phone: '+2348033332222'
        }
      });

    adminToken = setupRes.body.data.token;
    schoolId = setupRes.body.data.school._id;

    // Create class
    const classRes = await request(app)
      .post('/api/v1/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Basic 5',
        level: 'PRIMARY',
        arms: ['Gold', 'Silver']
      });

    const classId = classRes.body.data.class._id;

    // Register student
    const studentRes = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Faruk',
        surname: 'Ibrahim',
        dateOfBirth: '2015-04-12',
        gender: 'Male',
        homeAddress: 'Maitama Abuja',
        admissionSession: '2025/2026',
        currentClass: classId,
        currentArm: 'Gold',
        guardian: { fullName: 'Alhaji Ibrahim', phone: '+2348077778888' }
      });

    studentId = studentRes.body.data.student._id;

    // Register staff
    const staffRes = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Mallam Sani Bello',
        email: 'sani.bello@greenfield.edu.ng',
        phone: '+2348099990000',
        designation: 'Gate Security Supervisor',
        role: 'GATE_OFFICER',
        department: 'Security'
      });

    staffId = staffRes.body.data.staff._id;
  });

  it('issues a printable ID card with an opaque cryptographic QR token', async () => {
    const issueRes = await request(app)
      .post('/api/v1/id-cards/issue')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        holderType: 'STUDENT',
        id: studentId,
        reason: 'Initial Card Issuance'
      });

    expect(issueRes.status).toBe(201);
    expect(issueRes.body.success).toBe(true);
    const card = issueRes.body.data.card;

    expect(card.cardNumber).toMatch(/^CRD-GISA-S/);
    expect(card.qrCodeString).toMatch(/^SM-STU-GISA-/);
    expect(card.status).toBe('ACTIVE');
    expect(card.studentId.fullName).toBe('Ibrahim Faruk');

    // Verify token can be validated
    const verification = await verifyQRToken(card.qrCodeString, schoolId);
    expect(verification.isValid).toBe(true);
    expect(verification.student.firstName).toBe('Faruk');
  });

  it('automatically revokes previous active card when reissuing a replacement card', async () => {
    // Issue first card
    const firstCardRes = await request(app)
      .post('/api/v1/id-cards/issue')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ holderType: 'STUDENT', id: studentId });

    const firstCard = firstCardRes.body.data.card;

    // Issue second card (reissue)
    const secondCardRes = await request(app)
      .post('/api/v1/id-cards/issue')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ holderType: 'STUDENT', id: studentId, reason: 'Lost Card' });

    const secondCard = secondCardRes.body.data.card;

    expect(secondCard._id).not.toBe(firstCard._id);
    expect(secondCard.status).toBe('ACTIVE');
    expect(secondCard.reissueCount).toBe(1);

    // Verify the first card is now REPLACED
    const updatedFirstCard = await IDCard.findById(firstCard._id);
    expect(updatedFirstCard.status).toBe('REPLACED');

    // Verify scanning the old card fails
    const oldVerification = await verifyQRToken(firstCard.qrCodeString, schoolId);
    expect(oldVerification.isValid).toBe(false);
    expect(oldVerification.reason).toBe('CARD_REVOKED');
  });

  it('revokes an active card and prevents unauthorized attendance verification', async () => {
    const cardRes = await request(app)
      .post('/api/v1/id-cards/issue')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ holderType: 'STAFF', id: staffId });

    const card = cardRes.body.data.card;

    // Revoke the card
    const revokeRes = await request(app)
      .post(`/api/v1/id-cards/${card._id}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Reported stolen at gate' });

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.card.status).toBe('REVOKED');

    // Verify token check rejects the revoked card
    const verification = await verifyQRToken(card.qrCodeString, schoolId);
    expect(verification.isValid).toBe(false);
    expect(verification.reason).toBe('CARD_REVOKED');
  });
});
