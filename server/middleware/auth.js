const jwt = require('jsonwebtoken');
const config = require('../config');
const { db } = require('../db/schema');

function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Fetch user from DB to ensure account is active
    const user = db.prepare(`
      SELECT u.id, u.email, u.role, u.status, u.first_name, u.last_name,
             t.id as teacher_id, s.id as student_id, s.student_roll, s.current_session_id
      FROM users u
      LEFT JOIN teachers t ON t.user_id = u.id
      LEFT JOIN students s ON s.user_id = u.id
      WHERE u.id = ?
    `).get(decoded.id);

    if (!user || user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'User account not found or suspended.' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      teacherId: user.teacher_id,
      studentId: user.student_id,
      studentRoll: user.student_roll,
      currentSessionId: user.current_session_id,
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

function requireRoles(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Access restricted to roles [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
      });
    }

    next();
  };
}

module.exports = {
  authenticateUser,
  requireRoles,
};
