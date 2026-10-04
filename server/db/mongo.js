const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config');

// 1. SCHEMAS & MODELS

// User Schema
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'OFFICE_STAFF', 'TEACHER', 'STUDENT'], default: 'STUDENT' },
  status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phoneNumber: { type: String },
  teacherProfile: {
    designation: String,
    departmentCode: { type: String, default: 'CSE' },
    roomNumber: String,
  },
  studentProfile: {
    studentRoll: { type: String, sparse: true, uppercase: true },
    registrationNo: { type: String },
    currentSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  },
}, { timestamps: true });

// Academic Session Schema
const AcademicSessionSchema = new mongoose.Schema({
  sessionName: { type: String, required: true, unique: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  isCurrent: { type: Boolean, default: false },
}, { timestamps: true });

// Semester Schema
const SemesterSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true, index: true },
  semesterName: { type: String, required: true },
  termCode: { type: String, required: true }, // e.g. 'Y1S1', 'Y3S1'
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
SemesterSchema.index({ sessionId: 1, termCode: 1 }, { unique: true });

// Course Schema
const CourseSchema = new mongoose.Schema({
  semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true, index: true },
  courseCode: { type: String, required: true, uppercase: true, trim: true },
  courseTitle: { type: String, required: true, trim: true },
  creditHours: { type: Number, required: true, default: 3.0 },
  courseType: { type: String, enum: ['THEORY', 'LAB'], default: 'THEORY' },
  syllabusOutline: { type: String },
  assignedTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
CourseSchema.index({ semesterId: 1, courseCode: 1 }, { unique: true });

// Course Material Schema
const CourseMaterialSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  fileUrl: { type: String, required: true },
  fileType: { type: String },
  fileSize: { type: Number },
}, { timestamps: true });

// Class Test (CT) Marks Schema
const CTMarkSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  studentRoll: { type: String, required: true, uppercase: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ctNumber: { type: Number, required: true, min: 1, max: 5 },
  obtainedMarks: { type: Number, required: true, min: 0 },
  maxMarks: { type: Number, required: true, default: 20 },
  remarks: { type: String },
}, { timestamps: true });
CTMarkSchema.index({ courseId: 1, studentId: 1, ctNumber: 1 }, { unique: true });

// Notice Schema
const NoticeSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String },
  authorRole: { type: String },
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  attachmentUrl: { type: String },
  targetType: { type: String, enum: ['DEPARTMENT_WIDE', 'SESSION_SEMESTER_SPECIFIC'], default: 'DEPARTMENT_WIDE', index: true },
  targetSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  targetSemesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester' },
  isPinned: { type: Boolean, default: false },
}, { timestamps: true });

// Student Grievance Schema
const StudentGrievanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  studentName: { type: String },
  studentRoll: { type: String },
  sessionName: { type: String },
  category: { type: String, required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  isAnonymous: { type: Boolean, default: false },
  status: { type: String, enum: ['PENDING_MODERATION', 'APPROVED', 'REJECTED'], default: 'PENDING_MODERATION', index: true },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  moderationRemarks: { type: String },
  moderatedAt: { type: Date },
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const AcademicSession = mongoose.model('AcademicSession', AcademicSessionSchema);
const Semester = mongoose.model('Semester', SemesterSchema);
const Course = mongoose.model('Course', CourseSchema);
const CourseMaterial = mongoose.model('CourseMaterial', CourseMaterialSchema);
const CTMark = mongoose.model('CTMark', CTMarkSchema);
const Notice = mongoose.model('Notice', NoticeSchema);
const StudentGrievance = mongoose.model('StudentGrievance', StudentGrievanceSchema);

// 2. CONNECT TO MONGODB ATLAS
let isConnected = false;

async function connectMongoDB() {
  if (isConnected) return;
  try {
    console.log('[MongoDB Cloud] Connecting to MongoDB Atlas cluster0...');
    await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
    });
    isConnected = true;
    console.log('✅ [MongoDB Cloud] Successfully connected to Cluster0 database: cse_department');
    await seedMongoDatabase();
  } catch (err) {
    console.error('❌ [MongoDB Cloud] Connection error:', err.message);
  }
}

// 3. SEED INITIAL RECORDS INTO MONGODB CLOUD
async function seedMongoDatabase() {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log(`[MongoDB Cloud] Database already initialized with ${userCount} users.`);
      return;
    }

    console.log('[MongoDB Cloud] Seeding initial university hierarchy & roles into Atlas...');

    const passAdmin = bcrypt.hashSync('Admin@123', 10);
    const passOffice = bcrypt.hashSync('Office@123', 10);
    const passTeacher = bcrypt.hashSync('Teacher@123', 10);
    const passStudent = bcrypt.hashSync('Student@123', 10);

    // 1. Create Core Academic Session
    const session = await AcademicSession.create({
      sessionName: 'Session 2023-2024',
      startDate: new Date('2023-07-01'),
      endDate: new Date('2024-06-30'),
      isCurrent: true,
    });

    const sessionUpcoming = await AcademicSession.create({
      sessionName: 'Session 2024-2025',
      startDate: new Date('2024-07-01'),
      endDate: new Date('2025-06-30'),
      isCurrent: false,
    });

    // 2. Create Users
    const admin = await User.create({
      email: 'admin@cse.univ.edu',
      passwordHash: passAdmin,
      role: 'ADMIN',
      status: 'ACTIVE',
      firstName: 'System',
      lastName: 'Administrator',
      phoneNumber: '+8801700000001',
    });

    const office = await User.create({
      email: 'office@cse.univ.edu',
      passwordHash: passOffice,
      role: 'OFFICE_STAFF',
      status: 'ACTIVE',
      firstName: 'Academic',
      lastName: 'Office Staff',
      phoneNumber: '+8801700000002',
    });

    // Teachers
    const teacher1 = await User.create({
      email: 'rahman@cse.univ.edu',
      passwordHash: passTeacher,
      role: 'TEACHER',
      status: 'ACTIVE',
      firstName: 'Dr. Mahmudur',
      lastName: 'Rahman',
      phoneNumber: '+8801700000003',
      teacherProfile: {
        designation: 'Professor & Head of Research',
        departmentCode: 'CSE',
        roomNumber: 'Academic Bldg 3, Room 402',
      },
    });

    const teacher2 = await User.create({
      email: 'fatima@cse.univ.edu',
      passwordHash: passTeacher,
      role: 'TEACHER',
      status: 'ACTIVE',
      firstName: 'Dr. Sadia',
      lastName: 'Fatima',
      phoneNumber: '+8801700000004',
      teacherProfile: {
        designation: 'Associate Professor',
        departmentCode: 'CSE',
        roomNumber: 'Academic Bldg 3, Room 408',
      },
    });

    // Students
    const student1 = await User.create({
      email: 'student1@cse.univ.edu',
      passwordHash: passStudent,
      role: 'STUDENT',
      status: 'ACTIVE',
      firstName: 'Tanvir',
      lastName: 'Ahmed',
      phoneNumber: '+8801700000005',
      studentProfile: {
        studentRoll: 'CSE-20230101',
        registrationNo: 'REG-88201',
        currentSessionId: session._id,
      },
    });

    const student2 = await User.create({
      email: 'student2@cse.univ.edu',
      passwordHash: passStudent,
      role: 'STUDENT',
      status: 'ACTIVE',
      firstName: 'Nusrat',
      lastName: 'Jahan',
      phoneNumber: '+8801700000006',
      studentProfile: {
        studentRoll: 'CSE-20230102',
        registrationNo: 'REG-88202',
        currentSessionId: session._id,
      },
    });

    const student3 = await User.create({
      email: 'student3@cse.univ.edu',
      passwordHash: passStudent,
      role: 'STUDENT',
      status: 'ACTIVE',
      firstName: 'Fahim',
      lastName: 'Hossain',
      phoneNumber: '+8801700000007',
      studentProfile: {
        studentRoll: 'CSE-20230103',
        registrationNo: 'REG-88203',
        currentSessionId: session._id,
      },
    });

    // 3. Create Semesters
    const semY1S1 = await Semester.create({
      sessionId: session._id,
      semesterName: '1st Year 1st Semester',
      termCode: 'Y1S1',
      isActive: false,
    });

    const semY3S1 = await Semester.create({
      sessionId: session._id,
      semesterName: '3rd Year 1st Semester',
      termCode: 'Y3S1',
      isActive: true,
    });

    // 4. Create Courses & Assign Teachers
    const course3101 = await Course.create({
      semesterId: semY3S1._id,
      courseCode: 'CSE-3101',
      courseTitle: 'Database Management Systems',
      creditHours: 3.0,
      courseType: 'THEORY',
      syllabusOutline: 'Relational algebra, SQL, E-R modeling, Normalization, Query Processing, Transactions, Concurrency Control, and Recovery.',
      assignedTeacherId: teacher1._id, // Dr. Rahman
    });

    const course3102 = await Course.create({
      semesterId: semY3S1._id,
      courseCode: 'CSE-3102',
      courseTitle: 'Database Management Systems Lab',
      creditHours: 1.5,
      courseType: 'LAB',
      syllabusOutline: 'PostgreSQL indexing, triggers, stored procedures, and full-stack integration.',
      assignedTeacherId: teacher2._id, // Dr. Fatima
    });

    const course3103 = await Course.create({
      semesterId: semY3S1._id,
      courseCode: 'CSE-3103',
      courseTitle: 'Operating Systems & System Architecture',
      creditHours: 3.0,
      courseType: 'THEORY',
      syllabusOutline: 'Process scheduling, IPC, Semaphores, Deadlocks, Memory Management, and File Systems.',
      assignedTeacherId: teacher1._id, // Dr. Rahman
    });

    // 5. Course Materials
    await CourseMaterial.create({
      courseId: course3101._id,
      uploadedBy: teacher1._id,
      title: 'Lecture 01-03: Relational Algebra & SQL Mastery',
      description: 'Official slides covering the relational model, tuple calculus, and query optimization.',
      fileUrl: '/sample-materials/Lecture_01_Relational_Algebra.pdf',
      fileType: 'application/pdf',
      fileSize: 2048500,
    });

    // 6. CT Marks
    await CTMark.create({
      courseId: course3101._id,
      studentId: student1._id,
      studentRoll: 'CSE-20230101',
      recordedBy: teacher1._id,
      ctNumber: 1,
      obtainedMarks: 18.5,
      maxMarks: 20.0,
      remarks: 'Excellent SQL query optimization solution',
    });

    await CTMark.create({
      courseId: course3101._id,
      studentId: student2._id,
      studentRoll: 'CSE-20230102',
      recordedBy: teacher1._id,
      ctNumber: 1,
      obtainedMarks: 19.0,
      maxMarks: 20.0,
      remarks: 'Perfect ER diagram design',
    });

    // 7. Notices
    await Notice.create({
      authorId: office._id,
      authorName: 'Academic Office Staff',
      authorRole: 'OFFICE_STAFF',
      title: 'Announcement: Annual CSE Tech Fest & Hackathon 2026 Registration Open',
      content: 'All undergraduate students across all sessions are invited to register for the Annual CSE Tech Fest 2026. Hackathon tracks include AI, Security, and Cloud Architecture.',
      targetType: 'DEPARTMENT_WIDE',
      isPinned: true,
    });

    await Notice.create({
      authorId: office._id,
      authorName: 'Academic Office Staff',
      authorRole: 'OFFICE_STAFF',
      title: 'Schedule Update: Class Test 2 (CT-2) for 3rd Year 1st Semester',
      content: 'Attention 3rd Year 1st Semester students: CT-2 for CSE-3101 is officially scheduled for Tuesday, 10:30 AM in Room 402.',
      targetType: 'SESSION_SEMESTER_SPECIFIC',
      targetSessionId: session._id,
      targetSemesterId: semY3S1._id,
      isPinned: false,
    });

    // 8. Grievances
    await StudentGrievance.create({
      studentId: student1._id,
      studentName: 'Tanvir Ahmed',
      studentRoll: 'CSE-20230101',
      sessionName: 'Session 2023-2024',
      category: 'FACILITY',
      subject: 'Request for Extended Evening Hours in Software Engineering Lab 304',
      description: 'With project deadlines approaching, students need GPU workstation access in Lab 304 until 8:00 PM on weekdays.',
      isAnonymous: false,
      status: 'APPROVED',
      moderatedBy: office._id,
      moderationRemarks: 'Approved by Dept. Chair. Lab 304 will remain open until 8:00 PM with lab technician on duty starting next Monday.',
      moderatedAt: new Date(),
    });

    console.log('✅ [MongoDB Cloud] Academic database successfully seeded in Atlas!');
  } catch (err) {
    console.error('❌ [MongoDB Cloud] Seeding error:', err.message);
  }
}

module.exports = {
  connectMongoDB,
  User,
  AcademicSession,
  Semester,
  Course,
  CourseMaterial,
  CTMark,
  Notice,
  StudentGrievance,
};
