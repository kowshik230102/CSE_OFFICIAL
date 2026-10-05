const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const { db } = require('../db/schema');
const { authenticateUser, requireRoles } = require('../middleware/auth');

// 1. LOGIN
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare(`
    SELECT u.id, u.email, u.password_hash, u.role, u.status, u.first_name, u.last_name, u.phone_number,
           t.id as teacher_id, t.designation, t.room_number,
           s.id as student_id, s.student_roll, s.registration_no, s.current_session_id
    FROM users u
    LEFT JOIN teachers t ON t.user_id = u.id
    LEFT JOIN students s ON s.user_id = u.id
    WHERE LOWER(u.email) = LOWER(?)
  `).get(email);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (user.status !== 'ACTIVE') {
    return res.status(403).json({ error: 'This account has been suspended. Please contact the Department Administrator.' });
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  const isChair = user.email === 'chair.cse_pust@gmail.com' || (user.designation && user.designation.toLowerCase().includes('chair'));

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      firstName: user.first_name,
      lastName: user.last_name,
      phoneNumber: user.phone_number,
      teacherId: user.teacher_id,
      designation: user.designation,
      roomNumber: user.room_number,
      studentId: user.student_id,
      studentRoll: user.student_roll,
      registrationNo: user.registration_no,
      currentSessionId: user.current_session_id,
      isChair: Boolean(isChair),
    },
  });
});

// 1B. DEDICATED ADMIN LOGIN (Strictly verifies ADMIN role)
router.post('/admin-login', (req, res) => {
  const { email, password, adminKey } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Admin email and master password are required.' });
  }

  const user = db.prepare(`
    SELECT u.id, u.email, u.password_hash, u.role, u.status, u.first_name, u.last_name, u.phone_number
    FROM users u
    WHERE LOWER(u.email) = LOWER(?)
  `).get(email);

  if (!user) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }

  if (user.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Access Denied: This portal is strictly reserved for Department System Administrators. Please use the User Sign In tab for Faculty & Student access.',
    });
  }

  if (user.status !== 'ACTIVE') {
    return res.status(403).json({ error: 'This administrator account is suspended.' });
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      firstName: user.first_name,
      lastName: user.last_name,
      phoneNumber: user.phone_number,
    },
  });
});

// 1C. USER SIGN UP (Self-Registration for Students & Faculty)
router.post('/register', (req, res) => {
  const {
    email,
    password,
    firstName,
    lastName,
    role,
    phoneNumber,
    // Student specifics
    studentRoll,
    registrationNo,
    sessionId,
    // Teacher specifics
    designation,
    roomNumber,
  } = req.body;

  if (!email || !password || !firstName || !lastName || !role) {
    return res.status(400).json({ error: 'Email, password, first name, last name, and role are required.' });
  }

  if (role !== 'STUDENT') {
    return res.status(403).json({
      error: 'Access Denied: Public self-registration is strictly reserved for Students. Faculty (Teacher) and Staff accounts must be provisioned by the Department Chairman.',
    });
  }

  // Check duplicate email
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) {
    return res.status(400).json({ error: 'An account with this email address already exists. Please sign in.' });
  }

  // Student validations
  if (role === 'STUDENT') {
    if (!studentRoll || !registrationNo) {
      return res.status(400).json({ error: 'Student Roll Number and Registration Number are required.' });
    }
    const existingRoll = db.prepare('SELECT id FROM students WHERE UPPER(student_roll) = UPPER(?)').get(studentRoll);
    if (existingRoll) {
      return res.status(400).json({ error: 'A student with this roll number is already registered.' });
    }
  }

  const userId = 'u-' + crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);
  let resolvedSessionId = sessionId;

  if (role === 'STUDENT' && !resolvedSessionId) {
    // Pick current active session
    const currentSess = db.prepare('SELECT id FROM academic_sessions WHERE is_current = 1').get();
    resolvedSessionId = currentSess ? currentSess.id : 'sess-2023-24';
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, phone_number)
      VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
    `).run(userId, email.toLowerCase().trim(), passwordHash, role, firstName.trim(), lastName.trim(), phoneNumber || null);

    if (role === 'STUDENT') {
      const studentId = 's-' + crypto.randomUUID();
      db.prepare(`
        INSERT INTO students (id, user_id, student_roll, registration_no, current_session_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(studentId, userId, studentRoll.toUpperCase().trim(), registrationNo.trim(), resolvedSessionId);
    } else if (role === 'TEACHER') {
      const teacherId = 't-' + crypto.randomUUID();
      db.prepare(`
        INSERT INTO teachers (id, user_id, designation, department_code, room_number)
        VALUES (?, ?, ?, 'CSE', ?)
      `).run(teacherId, userId, designation || 'Assistant Professor', roomNumber || 'Academic Bldg 3');
    }
  });

  try {
    transaction();

    // Auto-login upon successful registration
    const user = db.prepare(`
      SELECT u.id, u.email, u.role, u.status, u.first_name, u.last_name, u.phone_number,
             t.id as teacher_id, t.designation, t.room_number,
             s.id as student_id, s.student_roll, s.registration_no, s.current_session_id,
             sess.session_name
      FROM users u
      LEFT JOIN teachers t ON t.user_id = u.id
      LEFT JOIN students s ON s.user_id = u.id
      LEFT JOIN academic_sessions sess ON sess.id = s.current_session_id
      WHERE u.id = ?
    `).get(userId);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Also sync to MongoDB Cloud Atlas asynchronously if connected
    try {
      const { User: MongoUser } = require('../db/mongo');
      MongoUser.create({
        email: user.email,
        passwordHash,
        role: user.role,
        status: 'ACTIVE',
        firstName: user.first_name,
        lastName: user.last_name,
        phoneNumber: user.phone_number,
        teacherProfile: role === 'TEACHER' ? { designation: user.designation, roomNumber: user.room_number } : undefined,
        studentProfile: role === 'STUDENT' ? { studentRoll: user.student_roll, registrationNo: user.registration_no } : undefined,
      }).catch(e => console.error('[Mongo Sync Error]', e.message));
    } catch (e) { /* ignore */ }

    return res.status(201).json({
      message: `Account created successfully! Welcome to the CSE Department Portal.`,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        firstName: user.first_name,
        lastName: user.last_name,
        phoneNumber: user.phone_number,
        teacherId: user.teacher_id,
        designation: user.designation,
        roomNumber: user.room_number,
        studentId: user.student_id,
        studentRoll: user.student_roll,
        registrationNo: user.registration_no,
        currentSessionId: user.current_session_id,
        sessionName: user.session_name,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// 1D. CHAIRMAN: CREATE TEACHER OR STAFF ACCOUNT
router.post('/chairman/create-account', authenticateUser, (req, res) => {
  const isChair = req.user.email === 'chair.cse_pust@gmail.com' ||
                  Boolean(req.user.isChair) ||
                  req.user.role === 'ADMIN';

  if (!isChair) {
    return res.status(403).json({ error: 'Access Denied: Only the Department Chairman can create Teacher and Staff accounts.' });
  }

  const { role, email, password, firstName, lastName, designation, roomNumber, phoneNumber } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (!['TEACHER', 'OFFICE_STAFF'].includes(role)) {
    return res.status(400).json({ error: 'Invalid account type. Please select either Teacher or Staff.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  // Check duplicate email
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) {
    return res.status(400).json({ error: `An account with email '${email}' already exists in the system.` });
  }

  // Automatic smart defaults if not provided
  let fName = (firstName && firstName.trim()) || '';
  let lName = (lastName && lastName.trim()) || '';
  if (!fName && !lName) {
    const emailPrefix = email.split('@')[0];
    fName = role === 'TEACHER' ? 'Faculty' : 'Office';
    lName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  } else if (!fName) {
    fName = role === 'TEACHER' ? 'Faculty' : 'Office';
  }

  const userId = 'u-' + crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);
  let teacherId = null;

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, phone_number)
      VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
    `).run(userId, email.toLowerCase().trim(), passwordHash, role, fName, lName, phoneNumber || null);

    if (role === 'TEACHER') {
      teacherId = 't-' + crypto.randomUUID();
      db.prepare(`
        INSERT INTO teachers (id, user_id, designation, department_code, room_number)
        VALUES (?, ?, ?, 'CSE', ?)
      `).run(teacherId, userId, designation || 'Assistant Professor', roomNumber || 'Academic Bldg 3, Room 405');
    }
  });

  try {
    transaction();

    // Async sync to Mongo if connected
    try {
      const { User: MongoUser } = require('../db/mongo');
      MongoUser.create({
        email: email.toLowerCase().trim(),
        passwordHash,
        role,
        status: 'ACTIVE',
        firstName: fName,
        lastName: lName,
        phoneNumber: phoneNumber || undefined,
        teacherProfile: role === 'TEACHER' ? { designation: designation || 'Assistant Professor', roomNumber: roomNumber || 'Academic Bldg 3' } : undefined,
      }).catch(e => console.error('[Mongo Sync Error]', e.message));
    } catch (e) { /* ignore */ }

    return res.status(201).json({
      message: `Successfully created ${role === 'TEACHER' ? 'Teacher' : 'Staff'} account for ${fName} ${lName} (${email})!`,
      account: {
        id: userId,
        email: email.toLowerCase().trim(),
        role,
        firstName: fName,
        lastName: lName,
        designation: role === 'TEACHER' ? (designation || 'Assistant Professor') : 'Academic Office Staff',
        roomNumber: roomNumber || 'Academic Bldg 3',
        teacherId,
        createdAt: new Date().toISOString(),
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create account: ' + err.message });
  }
});

// 1E. CHAIRMAN: LIST ALL TEACHER AND STAFF ACCOUNTS
router.get('/chairman/managed-accounts', authenticateUser, (req, res) => {
  const isChair = req.user.email === 'chair.cse_pust@gmail.com' ||
                  Boolean(req.user.isChair) ||
                  req.user.role === 'ADMIN';

  if (!isChair) {
    return res.status(403).json({ error: 'Access Denied: Chairman privileges required.' });
  }

  const accounts = db.prepare(`
    SELECT u.id, u.email, u.role, u.status, u.first_name, u.last_name, u.phone_number, u.created_at,
           t.id as teacher_id, t.designation, t.room_number,
           (SELECT COUNT(*) FROM course_assignments WHERE teacher_id = t.id) as assigned_courses_count
    FROM users u
    LEFT JOIN teachers t ON t.user_id = u.id
    WHERE u.role IN ('TEACHER', 'OFFICE_STAFF')
    ORDER BY u.created_at DESC
  `).all();

  return res.json({ accounts });
});

// 2. GET CURRENT PROFILE (/api/auth/me)
router.get('/me', authenticateUser, (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.email, u.role, u.status, u.first_name, u.last_name, u.phone_number,
           t.id as teacher_id, t.designation, t.room_number,
           s.id as student_id, s.student_roll, s.registration_no, s.current_session_id,
           sess.session_name
    FROM users u
    LEFT JOIN teachers t ON t.user_id = u.id
    LEFT JOIN students s ON s.user_id = u.id
    LEFT JOIN academic_sessions sess ON sess.id = s.current_session_id
    WHERE u.id = ?
  `).get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  const isChair = user.email === 'chair.cse_pust@gmail.com' || (user.designation && user.designation.toLowerCase().includes('chair'));

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      firstName: user.first_name,
      lastName: user.last_name,
      phoneNumber: user.phone_number,
      teacherId: user.teacher_id,
      designation: user.designation,
      roomNumber: user.room_number,
      studentId: user.student_id,
      studentRoll: user.student_roll,
      registrationNo: user.registration_no,
      currentSessionId: user.current_session_id,
      sessionName: user.session_name,
      isChair: Boolean(isChair),
    },
  });
});

// 3. CHANGE PASSWORD (Teachers & All Users)
router.post('/change-password', authenticateUser, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current password and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const isMatch = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!isMatch) {
    return res.status(400).json({ error: 'Current password does not match.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    newHash,
    req.user.id
  );

  return res.json({ message: 'Password updated successfully!' });
});

// 4. ADMIN: CREATE OFFICE STAFF OR TEACHER ACCOUNT
router.post('/users', authenticateUser, requireRoles(['ADMIN']), (req, res) => {
  const { email, password, role, firstName, lastName, phoneNumber, designation, roomNumber } = req.body;

  if (!email || !password || !role || !firstName || !lastName) {
    return res.status(400).json({ error: 'Email, password, role, firstName, and lastName are required.' });
  }

  if (!['OFFICE_STAFF', 'TEACHER', 'ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role for direct account creation.' });
  }

  // Check duplicate
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) {
    return res.status(400).json({ error: 'A user with this email already exists.' });
  }

  const userId = 'u-' + crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);

  const insertUser = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, phone_number)
      VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
    `).run(userId, email, passwordHash, role, firstName, lastName, phoneNumber || null);

    if (role === 'TEACHER') {
      const teacherId = 't-' + crypto.randomUUID();
      db.prepare(`
        INSERT INTO teachers (id, user_id, designation, department_code, room_number)
        VALUES (?, ?, ?, 'CSE', ?)
      `).run(teacherId, userId, designation || 'Lecturer', roomNumber || 'Academic Bldg 3');
    }
  });

  try {
    insertUser();
    return res.status(201).json({ message: `Account for ${firstName} ${lastName} (${role}) created successfully!` });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create user account: ' + err.message });
  }
});

// 5. ADMIN: LIST ALL USERS & STATS
router.get('/users', authenticateUser, requireRoles(['ADMIN', 'OFFICE_STAFF']), (req, res) => {
  const { role } = req.query;
  let query = `
    SELECT u.id, u.email, u.role, u.status, u.first_name, u.last_name, u.phone_number, u.created_at,
           t.designation, t.room_number,
           s.student_roll, s.registration_no, sess.session_name
    FROM users u
    LEFT JOIN teachers t ON t.user_id = u.id
    LEFT JOIN students s ON s.user_id = u.id
    LEFT JOIN academic_sessions sess ON sess.id = s.current_session_id
  `;
  const params = [];
  if (role) {
    query += ' WHERE u.role = ?';
    params.push(role);
  }
  query += ' ORDER BY u.created_at DESC';

  const users = db.prepare(query).all(...params);
  return res.json({ users });
});

// 6. ADMIN: TOGGLE USER STATUS (ACTIVE / SUSPENDED)
router.patch('/users/:id/status', authenticateUser, requireRoles(['ADMIN']), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be ACTIVE or SUSPENDED.' });
  }

  if (id === req.user.id) {
    return res.status(400).json({ error: 'You cannot suspend your own admin account.' });
  }

  const result = db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'User not found.' });
  }

  return res.json({ message: `User status changed to ${status}.` });
});

// 7. LIST ALL FACULTY TEACHERS (Used in Course Assignment Dropdowns)
router.get('/teachers', authenticateUser, (req, res) => {
  const teachers = db.prepare(`
    SELECT t.id as teacher_id, t.designation, t.department_code, t.room_number,
           u.id as user_id, u.first_name, u.last_name, u.email, u.phone_number
    FROM teachers t
    JOIN users u ON u.id = t.user_id
    WHERE u.status = 'ACTIVE'
    ORDER BY u.first_name ASC
  `).all();

  return res.json({ teachers });
});

// 8. CHAIRMAN EXCLUSIVE: CREATE STAFF OR TEACHER ACCOUNT
router.post('/chairman/create-account', authenticateUser, (req, res) => {
  const isChairman = req.user.email === 'chair.cse_pust@gmail.com' || req.user.role === 'ADMIN';
  if (!isChairman) {
    const teacher = db.prepare('SELECT designation FROM teachers WHERE user_id = ?').get(req.user.id);
    if (!teacher || !teacher.designation || !teacher.designation.toLowerCase().includes('chair')) {
      return res.status(403).json({ error: 'Access Denied: Only the Department Chairman can provision Staff and Teacher accounts.' });
    }
  }

  const { role, email, password, firstName, lastName, designation, roomNumber, phoneNumber } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required to create an account.' });
  }

  const normalizedRole = (role || '').toUpperCase().trim();
  if (!['TEACHER', 'OFFICE_STAFF'].includes(normalizedRole)) {
    return res.status(400).json({ error: 'Invalid account type. You can only create accounts for Teacher or Staff.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check duplicate email
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(normalizedEmail);
  if (existing) {
    return res.status(400).json({ error: `An account with email "${normalizedEmail}" already exists in the system.` });
  }

  // Derive reasonable names if omitted
  let resolvedFirstName = (firstName || '').trim();
  let resolvedLastName = (lastName || '').trim();
  if (!resolvedFirstName && !resolvedLastName) {
    const emailPrefix = normalizedEmail.split('@')[0];
    const parts = emailPrefix.split(/[._-]/).filter(Boolean);
    if (parts.length >= 2) {
      resolvedFirstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      resolvedLastName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    } else {
      resolvedFirstName = normalizedRole === 'TEACHER' ? 'Faculty' : 'Office';
      resolvedLastName = normalizedRole === 'TEACHER' ? 'Teacher' : 'Staff';
    }
  } else if (!resolvedFirstName) {
    resolvedFirstName = normalizedRole === 'TEACHER' ? 'Faculty' : 'Staff';
  } else if (!resolvedLastName) {
    resolvedLastName = 'Member';
  }

  const resolvedDesignation = (designation || '').trim() || (normalizedRole === 'TEACHER' ? 'Lecturer' : 'Administrative Officer');
  const resolvedRoom = (roomNumber || '').trim() || (normalizedRole === 'TEACHER' ? 'Faculty Lounge, 3rd Floor' : 'Department Office, Room 302');

  const userId = 'u-' + crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);

  const insertTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, phone_number)
      VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
    `).run(userId, normalizedEmail, passwordHash, normalizedRole, resolvedFirstName, resolvedLastName, phoneNumber || null);

    if (normalizedRole === 'TEACHER') {
      const teacherId = 't-' + crypto.randomUUID();
      db.prepare(`
        INSERT INTO teachers (id, user_id, designation, department_code, room_number)
        VALUES (?, ?, ?, 'CSE', ?)
      `).run(teacherId, userId, resolvedDesignation, resolvedRoom);
    }
  });

  try {
    insertTx();
    return res.status(201).json({
      success: true,
      message: `Successfully created ${normalizedRole === 'TEACHER' ? 'Teacher' : 'Staff'} account for ${normalizedEmail}!`,
      account: {
        id: userId,
        email: normalizedEmail,
        role: normalizedRole,
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        designation: resolvedDesignation,
        roomNumber: resolvedRoom,
        phoneNumber: phoneNumber || null,
        plainPassword: password,
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Database error provisioning account: ' + err.message });
  }
});

// 9. CHAIRMAN EXCLUSIVE: GET ALL MANAGED TEACHER & STAFF ACCOUNTS
router.get('/chairman/managed-accounts', authenticateUser, (req, res) => {
  const isChairman = req.user.email === 'chair.cse_pust@gmail.com' || req.user.role === 'ADMIN';
  if (!isChairman) {
    const teacher = db.prepare('SELECT designation FROM teachers WHERE user_id = ?').get(req.user.id);
    if (!teacher || !teacher.designation || !teacher.designation.toLowerCase().includes('chair')) {
      return res.status(403).json({ error: 'Access Denied: Only the Department Chairman can view this directory.' });
    }
  }

  const accounts = db.prepare(`
    SELECT u.id, u.email, u.role, u.status, u.first_name, u.last_name, u.phone_number, u.created_at,
           t.id as teacher_id, t.designation, t.room_number
    FROM users u
    LEFT JOIN teachers t ON t.user_id = u.id
    WHERE u.role IN ('TEACHER', 'OFFICE_STAFF')
    ORDER BY u.created_at DESC
  `).all();

  return res.json({ success: true, accounts });
});

module.exports = router;
