const { db } = require('../db/schema');

/**
 * Middleware ensuring ONLY the assigned teacher for this specific course
 * (or system ADMIN / OFFICE_STAFF for management overrides)
 * can modify course workspace materials or post/edit CT marks.
 */
function verifyCourseFaculty(req, res, next) {
  const { courseId } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  // Admins, Office Staff, and Department Chairman have academic management override privileges
  if (user.role === 'ADMIN' || user.role === 'OFFICE_STAFF' || user.email === 'chair.cse_pust@gmail.com' || user.isChair) {
    return next();
  }

  // If the user is a Teacher, verify that they are officially assigned to this course
  if (user.role === 'TEACHER') {
    if (!user.teacherId) {
      return res.status(403).json({ error: 'Forbidden: No valid teacher profile associated with this account.' });
    }

    const assignment = db.prepare(`
      SELECT id FROM course_assignments
      WHERE course_id = ? AND teacher_id = ?
    `).get(courseId, user.teacherId);

    if (!assignment) {
      return res.status(403).json({
        error: 'Forbidden: You are NOT assigned as the faculty member for this course. Only the officially assigned teacher can upload materials or enter CT marks.',
      });
    }

    return next();
  }

  // Students and unauthorized roles cannot edit course workspaces
  return res.status(403).json({
    error: 'Forbidden: You do not have permission to modify this course workspace.',
  });
}

module.exports = {
  verifyCourseFaculty,
};
