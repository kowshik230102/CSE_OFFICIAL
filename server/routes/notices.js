const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db/schema');
const { authenticateUser, requireRoles } = require('../middleware/auth');

// 1. GET ALL NOTICES (With Optional Targeted Filtering & Category Filtering)
router.get('/', (req, res) => {
  const { sessionId, semesterId, targetType, category } = req.query;

  let query = `
    SELECT n.*, 
           u.first_name || ' ' || u.last_name as author_name,
           u.role as author_role,
           sess.session_name,
           sem.semester_name, sem.term_code
    FROM notices n
    JOIN users u ON u.id = n.author_id
    LEFT JOIN academic_sessions sess ON sess.id = n.target_session_id
    LEFT JOIN semesters sem ON sem.id = n.target_semester_id
    WHERE 1=1
  `;
  const params = [];

  if (category && category !== 'ALL') {
    query += " AND n.category = ?";
    params.push(category);
  }

  if (targetType === 'DEPARTMENT_WIDE') {
    query += " AND n.target_type = 'DEPARTMENT_WIDE'";
  } else if (sessionId && semesterId) {
    // Show either department-wide notices OR notices targeted to this specific session & semester
    query += `
      AND (
        n.target_type = 'DEPARTMENT_WIDE' 
        OR (n.target_session_id = ? AND (n.target_semester_id = ? OR n.target_semester_id IS NULL))
      )
    `;
    params.push(sessionId, semesterId);
  } else if (sessionId) {
    query += `
      AND (
        n.target_type = 'DEPARTMENT_WIDE'
        OR n.target_session_id = ?
      )
    `;
    params.push(sessionId);
  }

  query += ' ORDER BY n.is_pinned DESC, n.created_at DESC';

  const notices = db.prepare(query).all(...params);
  return res.json({ notices });
});

// 2. CREATE A NOTICE (Office staff, Teachers, and Students)
router.post('/', authenticateUser, requireRoles(['OFFICE_STAFF', 'ADMIN', 'TEACHER', 'STUDENT']), (req, res) => {
  const { title, content, category, targetType, targetSessionId, targetSemesterId, isPinned, attachmentUrl } = req.body;

  if (!title || !title.trim() || !content || !content.trim()) {
    return res.status(400).json({ error: 'Notice title and content are required.' });
  }

  const noticeId = 'not-' + crypto.randomUUID();
  const allowedCategories = ['Academic', 'Exam', 'Notice', 'Event'];
  const resolvedCategory = allowedCategories.includes(category) ? category : 'Notice';
  const type = targetType === 'SESSION_SEMESTER_SPECIFIC' ? 'SESSION_SEMESTER_SPECIFIC' : 'DEPARTMENT_WIDE';

  // Only Office Staff, Teachers, and Admin can pin notices
  const canPin = ['OFFICE_STAFF', 'ADMIN', 'TEACHER'].includes(req.user.role);
  const pinFlag = (canPin && isPinned) ? 1 : 0;

  try {
    db.prepare(`
      INSERT INTO notices (id, author_id, title, content, category, attachment_url, target_type, target_session_id, target_semester_id, is_pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      noticeId,
      req.user.id,
      title.trim(),
      content.trim(),
      resolvedCategory,
      attachmentUrl ? attachmentUrl.trim() : null,
      type,
      type === 'SESSION_SEMESTER_SPECIFIC' ? (targetSessionId || null) : null,
      type === 'SESSION_SEMESTER_SPECIFIC' ? (targetSemesterId || null) : null,
      pinFlag
    );

    const createdNotice = db.prepare(`
      SELECT n.*, 
             u.first_name || ' ' || u.last_name as author_name,
             u.role as author_role
      FROM notices n
      JOIN users u ON u.id = n.author_id
      WHERE n.id = ?
    `).get(noticeId);

    return res.status(201).json({ 
      message: 'Notice published successfully!', 
      noticeId, 
      notice: createdNotice 
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to publish notice: ' + err.message });
  }
});

// 3. DELETE A NOTICE (Author or Office Staff/Admin)
router.delete('/:id', authenticateUser, (req, res) => {
  const { id } = req.params;
  const notice = db.prepare('SELECT * FROM notices WHERE id = ?').get(id);

  if (!notice) {
    return res.status(404).json({ error: 'Notice not found.' });
  }

  // Only the original author, Office Staff, or Admin can delete
  if (req.user.role !== 'ADMIN' && req.user.role !== 'OFFICE_STAFF' && notice.author_id !== req.user.id) {
    return res.status(403).json({ error: 'You are not authorized to delete this notice.' });
  }

  const result = db.prepare('DELETE FROM notices WHERE id = ?').run(id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Notice could not be deleted.' });
  }

  return res.json({ message: 'Notice deleted successfully.' });
});

module.exports = router;
