const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config');
const { initializeDatabase } = require('./db/schema');
const { connectMongoDB } = require('./db/mongo');

// Initialize Databases
initializeDatabase();
connectMongoDB();

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static file serving for uploads (lecture notes, syllabi, PDF files)
app.use('/uploads', express.static(config.UPLOAD_DIR));

// Provide static placeholder/sample materials so links in seed data work out of the box
app.use('/sample-materials', express.static(path.join(__dirname, 'sample-materials')));

// Ensure sample-materials folder has placeholder documents
const sampleDir = path.join(__dirname, 'sample-materials');
if (!require('fs').existsSync(sampleDir)) {
  require('fs').mkdirSync(sampleDir, { recursive: true });
  require('fs').writeFileSync(
    path.join(sampleDir, 'Lecture_01_Relational_Algebra.pdf'),
    'Sample Academic Content: CSE-3101 Database Management Systems Lecture 01-03 Notes on Relational Algebra.'
  );
  require('fs').writeFileSync(
    path.join(sampleDir, 'CSE3101_Course_Outline_2026.pdf'),
    'Sample Academic Content: CSE-3101 Syllabus and Evaluation Grading Breakdown.'
  );
}

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/academic', require('./routes/academic'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/notices', require('./routes/notices'));
app.use('/api/grievances', require('./routes/grievances'));
app.use('/api/routines', require('./routes/routines'));

// Health & System Information
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    status: 'ONLINE',
    department: 'Department of Computer Science & Engineering',
    activeStudentsTarget: '5000+',
    database: {
      type: 'MongoDB Cloud Atlas (Cluster0)',
      status: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'CONNECTING',
      cluster: 'cluster0.4rqrkzz.mongodb.net',
      databaseName: 'cse_department',
    },
    timestamp: new Date().toISOString(),
  });
});

// Static Frontend Serving (if built)
const distPath = path.join(__dirname, '..', 'dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads') && !req.path.startsWith('/sample-materials')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// Central Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

const server = app.listen(config.PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 CSE Department Management Platform Backend Active`);
  console.log(`📡 URL: http://localhost:${config.PORT}`);
  console.log(`👥 Target Capacity: 5,000+ Concurrent Students`);
  console.log(`=======================================================`);
});

module.exports = { app, server };
