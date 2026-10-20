import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { Guardian } from '../src/models/Guardian.js';
import { Student } from '../src/models/Student.js';
import { Staff } from '../src/models/Staff.js';
import { User } from '../src/models/User.js';

describe('Stage 2: Student & Staff Registration, Unique ID Generation & Directories', () => {
  let adminToken;
  let schoolId;
  let classId;

  beforeEach(async () => {
    // Register school and admin
    const setupRes = await request(app)
      .post('/api/v1/auth/register-admin')
      .send({
        school: {
          name: 'Corona Secondary School Agbara',
          code: 'CSSA',
          schoolType: 'SECONDARY',
          email: 'info@coronaschools.org',
          phone: '+2348023456789',
          state: 'Ogun',
          lga: 'Ado-Odo/Ota',
          address: 'KM 14, Badagry Expressway',
          currentSession: '2025/2026',
          currentTerm: 'First Term'
        },
        admin: {
          fullName: 'Mrs. Adunola Bankole',
          email: 'principal@coronaschools.org',
          password: 'CoronaPassword2026!',
          phone: '+2348023456789'
        }
      });

    adminToken = setupRes.body.data.token;
    schoolId = setupRes.body.data.school._id;

    // Create a class
    const classRes = await request(app)
      .post('/api/v1/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'JSS 1',
        level: 'JSS',
        arms: ['Gold', 'Silver', 'Bronze'],
        subjects: ['Mathematics', 'English Language', 'Basic Science', 'French']
      });

    classId = classRes.body.data.class._id;
  });

  it('registers a student with unique admission number and guardian details', async () => {
    const studentRes = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Chidinma',
        middleName: 'Blessing',
        surname: 'Okafor',
        dateOfBirth: '2012-05-14',
        gender: 'Female',
        stateOfOrigin: 'Anambra',
        homeAddress: 'Plot 8, Royal Palm Estate, Agbara',
        admissionSession: '2025/2026',
        currentClass: classId,
        currentArm: 'Gold',
        medicalInfo: {
          bloodGroup: 'O+',
          genotype: 'AA'
        },
        guardian: {
          fullName: 'Chief Emeka Okafor',
          relationship: 'Father',
          phone: '+2348099887766',
          email: 'emeka.okafor@gmail.com'
        }
      });

    expect(studentRes.status).toBe(201);
    expect(studentRes.body.success).toBe(true);
    expect(studentRes.body.data.student.admissionNumber).toBe('CSSA/2025/0001');
    expect(studentRes.body.data.student.firstName).toBe('Chidinma');
    expect(studentRes.body.data.student.surname).toBe('Okafor');
    expect(studentRes.body.data.student.primaryGuardian).toBeDefined();
    expect(studentRes.body.data.student.primaryGuardian.fullName).toBe('Chief Emeka Okafor');
  });

  it('deduplicates guardian when registering a sibling and generates consecutive admission number', async () => {
    // Register first child
    await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Chidinma',
        surname: 'Okafor',
        dateOfBirth: '2012-05-14',
        gender: 'Female',
        homeAddress: 'Plot 8, Royal Palm Estate, Agbara',
        admissionSession: '2025/2026',
        currentClass: classId,
        currentArm: 'Gold',
        guardian: {
          fullName: 'Chief Emeka Okafor',
          relationship: 'Father',
          phone: '+2348099887766',
          email: 'emeka.okafor@gmail.com'
        }
      });

    // Register second child (sibling) with same guardian phone number
    const siblingRes = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Somtochukwu',
        surname: 'Okafor',
        dateOfBirth: '2014-08-20',
        gender: 'Male',
        homeAddress: 'Plot 8, Royal Palm Estate, Agbara',
        admissionSession: '2025/2026',
        currentClass: classId,
        currentArm: 'Silver',
        guardian: {
          fullName: 'Chief Emeka Okafor',
          relationship: 'Father',
          phone: '+2348099887766',
          email: 'emeka.okafor@gmail.com'
        }
      });

    expect(siblingRes.status).toBe(201);
    expect(siblingRes.body.data.student.admissionNumber).toBe('CSSA/2025/0002');

    // Verify only ONE guardian record was created in the database
    const guardianCount = await Guardian.countDocuments({ phone: '+2348099887766' });
    expect(guardianCount).toBe(1);

    const guardianDoc = await Guardian.findOne({ phone: '+2348099887766' });
    expect(guardianDoc.wards.length).toBe(2);
  });

  it('searches and filters students by class, arm, and name', async () => {
    // Register two students
    await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Tunde',
        surname: 'Bakare',
        dateOfBirth: '2011-03-10',
        gender: 'Male',
        homeAddress: 'Ikeja Lagos',
        admissionSession: '2025/2026',
        currentClass: classId,
        currentArm: 'Gold',
        guardian: { fullName: 'Mr. Bakare', phone: '+2348011112222' }
      });

    await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Ngozi',
        surname: 'Eze',
        dateOfBirth: '2012-07-22',
        gender: 'Female',
        homeAddress: 'Victoria Island',
        admissionSession: '2025/2026',
        currentClass: classId,
        currentArm: 'Silver',
        guardian: { fullName: 'Mrs. Eze', phone: '+2348033334444' }
      });

    // Search by name "Tunde"
    const searchRes = await request(app)
      .get('/api/v1/students?search=Tunde')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBe(1);
    expect(searchRes.body.data[0].firstName).toBe('Tunde');

    // Filter by arm "Silver"
    const filterArmRes = await request(app)
      .get(`/api/v1/students?arm=Silver`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(filterArmRes.status).toBe(200);
    expect(filterArmRes.body.data.length).toBe(1);
    expect(filterArmRes.body.data[0].firstName).toBe('Ngozi');
  });

  it('registers a staff member, generates unique staff ID, and provisions login account', async () => {
    const staffRes = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Mr. Babatunde Fashola',
        email: 'babatunde.teacher@coronaschools.org',
        phone: '+2348055667788',
        gender: 'Male',
        department: 'Science & Mathematics',
        designation: 'Senior Mathematics Master',
        role: 'CLASS_TEACHER',
        employmentType: 'FULL_TIME',
        assignedClasses: [
          {
            classId,
            arm: 'Gold',
            subject: 'Mathematics',
            isClassTeacher: true
          }
        ],
        qualifications: [
          { degree: 'B.Sc. Mathematics Education', institution: 'UNILAG', year: 2016 }
        ]
      });

    expect(staffRes.status).toBe(201);
    expect(staffRes.body.data.staff.staffId).toBe('CSSA/STF/0001');
    expect(staffRes.body.data.staff.fullName).toBe('Mr. Babatunde Fashola');

    // Verify user login account was created and can sign in
    const userDoc = await User.findOne({ email: 'babatunde.teacher@coronaschools.org' });
    expect(userDoc).not.toBeNull();
    expect(userDoc.role).toBe('CLASS_TEACHER');

    const teacherLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'babatunde.teacher@coronaschools.org',
        password: 'SchoolMag2026!'
      });

    expect(teacherLogin.status).toBe(200);
    expect(teacherLogin.body.data.user.role).toBe('CLASS_TEACHER');
  });
});
