require('dotenv').config();
const mongoose = require('mongoose');

console.log('Testing Models Compilation...');
try {
  const models = require('./src/models');
  console.log('✅ Models loaded successfully!');
  console.log('Available models:', Object.keys(models));
} catch (err) {
  console.error('❌ Models loading failed:', err);
  process.exit(1);
}

process.exit(0);
