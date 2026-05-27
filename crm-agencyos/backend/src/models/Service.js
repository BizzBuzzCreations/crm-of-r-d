const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
  name:        { type: String, required: [true, 'Service name is required'], trim: true },
  description: { type: String, default: '' },
  category:    { type: String, default: 'General', trim: true },
  color:       { type: String, default: '#6366f1' },
  icon:        { type: String, default: '⚡' },
  isActive:    { type: Boolean, default: true },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('Service', ServiceSchema);
