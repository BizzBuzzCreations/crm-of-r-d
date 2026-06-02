const mongoose = require('mongoose');

const LeadContactSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  role:  { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' }
}, { _id: false });

const LeadNoteSchema = new mongoose.Schema({
  text:       { type: String, required: true },
  author:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: { type: String, default: 'System' },
  createdAt:  { type: Date, default: Date.now }
});

const LeadActivitySchema = new mongoose.Schema({
  type:        { type: String, default: 'general' }, // 'create', 'status_change', 'assign', 'note', 'watcher', 'sla'
  text:        { type: String, required: true },
  performedBy: { type: String, default: 'System' },
  createdAt:   { type: Date, default: Date.now }
});

const LeadSchema = new mongoose.Schema({
  companyName:   { type: String, required: [true, 'Company name is required'], trim: true },
  contactPerson: { type: String, required: [true, 'Contact person is required'], trim: true },
  email:         { type: String, default: '' },
  phone:         { type: String, default: '' },
  website:       { type: String, default: '' },
  dealValue:     { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['New Lead', 'First Contact', 'Proposal Sent', 'Won', 'Lost'],
    default: 'New Lead'
  },
  source: {
    type: String,
    enum: ['Manual', 'Import', 'Web Form'],
    default: 'Manual'
  },
  assignedTo:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  watchers:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  contacts:     [LeadContactSchema],
  notes:        [LeadNoteSchema],
  activities:   [LeadActivitySchema],
  
  // Scoring parameters
  interactionsCount: { type: Number, default: 0 },
  websiteVisits:     { type: Number, default: 0 },
  emailOpens:        { type: Number, default: 0 },
  proposalViews:     { type: Number, default: 0 },
  lastContactDate:   { type: Date, default: Date.now },

  // SLA fields
  slaDeadline: { type: Date },
  slaBreached: { type: Boolean, default: false },

  // Enterprise additions
  leadId:           { type: String, unique: true },
  nextFollowUpDate: { type: Date },
  tags:             [{ type: String }],
  archived:         { type: Boolean, default: false },
  customFields:     { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

LeadSchema.statics.getNextLeadNumber = async function () {
  const existing = await this.find({ leadId: { $regex: /^LD-\d+$/ } })
    .select('leadId')
    .lean();

  const maxNum = existing.reduce((max, lead) => {
    const match = String(lead.leadId || '').match(/^LD-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 1000);

  return maxNum + 1;
};

// Pre-save to auto-initialize SLA Response Deadline and generate sequential Lead ID
LeadSchema.pre('save', async function (next) {
  if (this.isNew && !this.slaDeadline) {
    this.slaDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours SLA
  }
  if (!this.leadId) {
    try {
      const LeadModel = this.constructor;
      const nextNum = await LeadModel.getNextLeadNumber();
      this.leadId = `LD-${nextNum}`;
    } catch (err) {
      this.leadId = `LD-${Date.now().toString().slice(-4)}`;
    }
  }
  next();
});

module.exports = mongoose.model('Lead', LeadSchema);
