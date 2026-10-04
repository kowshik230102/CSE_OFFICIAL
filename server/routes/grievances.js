const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db/schema');
const { authenticateUser, requireRoles } = require('../middleware/auth');

// 1. PUBLIC / APPROVED FEED (Visible to all logged-in students, teachers, office, admin)
router.get('/public-feed', authenticateUser, (req, res) => {
  const grievances = db.prepare(`
    SELECT g.id, g.category, g.subject, g.description, g.is_anonymous, g.created_at,
           g.moderated_at, g.moderation_remarks,
           CASE WHEN g.is_anonymous = 1 THEN 'Anonymous Student' ELSE u.first_name || ' ' || u.last_name END as submitter_name,
           CASE WHEN g.is_anonymous = 1 THEN 'CSE' ELSE s.student_roll END as student_roll,
           mod_u.first_name || ' ' || mod_u.last_name as moderator_name
    FROM student_grievances g
    JOIN students s ON s.id = g.student_id
    JOIN users u ON u.id = s.user_id
    LEFT JOIN users mod_u ON mod_u.id = g.moderated_by
    WHERE g.status = 'APPROVED'
    ORDER BY g.created_at DESC
  `).all();

  return res.json({ grievances });
});

// 2. SUBMIT GRIEVANCE / FEEDBACK (Students Only)
router.post('/', authenticateUser, requireRoles(['STUDENT']), (req, res) => {
  const { category, subject, description, isAnonymous } = req.body;

  if (!category || !subject || !description) {
    return res.status(400).json({ error: 'Category, subject, and description are required.' });
  }

  const studentId = req.user.studentId;
  if (!studentId) {
    return res.status(403).json({ error: 'No student profile linked to this account.' });
  }

  const grievanceId = 'grv-' + crypto.randomUUID();

  try {
    db.prepare(`
      INSERT INTO student_grievances (id, student_id, category, subject, description, is_anonymous, status)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING_MODERATION')
    `).run(
      grievanceId,
      studentId,
      category,
      subject.trim(),
      description.trim(),
      isAnonymous ? 1 : 0
    );

    return res.status(201).json({
      message: 'Feedback submitted successfully! It has been routed to the moderation queue for review before public posting.',
      grievanceId,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to submit grievance: ' + err.message });
  }
});

// 3. STUDENT'S OWN SUBMISSIONS
router.get('/my-submissions', authenticateUser, requireRoles(['STUDENT']), (req, res) => {
  const studentId = req.user.studentId;
  const submissions = db.prepare(`
    SELECT * FROM student_grievances
    WHERE student_id = ?
    ORDER BY created_at DESC
  `).all(studentId);

  return res.json({ submissions });
});

// 4. MODERATION QUEUE (Admin & Office Staff Only)
router.get('/queue', authenticateUser, requireRoles(['OFFICE_STAFF', 'ADMIN']), (req, res) => {
  const queue = db.prepare(`
    SELECT g.*,
           u.first_name || ' ' || u.last_name as student_name,
           u.email as student_email,
           s.student_roll,
           sess.session_name
    FROM student_grievances g
    JOIN students s ON s.id = g.student_id
    JOIN users u ON u.id = s.user_id
    JOIN academic_sessions sess ON sess.id = s.current_session_id
    ORDER BY CASE WHEN g.status = 'PENDING_MODERATION' THEN 0 ELSE 1 END, g.created_at DESC
  `).all();

  return res.json({ queue });
});

// 5. MODERATE: APPROVE OR REJECT (Admin & Office Staff Only)
router.patch('/:id/moderate', authenticateUser, requireRoles(['OFFICE_STAFF', 'ADMIN']), (req, res) => {
  const { id } = req.params;
  const { action, remarks } = req.body; // action: 'APPROVED' | 'REJECTED'

  if (!['APPROVED', 'REJECTED'].includes(action)) {
    return res.status(400).json({ error: 'Action must be either APPROVED or REJECTED.' });
  }

  const result = db.prepare(`
    UPDATE student_grievances
    SET status = ?,
        moderated_by = ?,
        moderation_remarks = ?,
        moderated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(action, req.user.id, remarks || null, id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Grievance not found.' });
  }

  return res.json({ message: `Grievance status updated to ${action}.` });
});

module.exports = router;
