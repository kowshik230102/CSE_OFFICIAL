const path = require('path');
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://cse_official:cqRZd3Syjr4oCdeE@cluster0.4rqrkzz.mongodb.net/cse_department?retryWrites=true&w=majority&appName=Cluster0',
  JWT_SECRET: process.env.JWT_SECRET || 'cse_univ_super_secret_jwt_key_2026_secure',
  JWT_EXPIRES_IN: '7d',
  DB_PATH: path.join(__dirname, 'cse_department.sqlite'),
  UPLOAD_DIR: path.join(__dirname, 'uploads'),
};
