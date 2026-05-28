const mongoose = require('mongoose');

const PipelineStageSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  color:       { type: String, default: '#6366f1' },
  probability: { type: Number, default: 100 } // percentage
});

const PipelineSchema = new mongoose.Schema({
  name:        { type: String, default: 'Sales Funnel' },
  stages:      [PipelineStageSchema],
  lostReasons: [{ type: String }],
  wonReasons:  [{ type: String }]
});

const CustomFieldSchema = new mongoose.Schema({
  module:   { type: String, enum: ['Contacts', 'Companies', 'Deals'], required: true },
  name:     { type: String, required: true },
  label:    { type: String, required: true },
  type:     { type: String, enum: ['text', 'number', 'date', 'boolean', 'select'], required: true },
  options:  [{ type: String }], // for select type
  required: { type: Boolean, default: false }
});

const SystemRoleSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  label:       { type: String, required: true },
  permissions: [{ type: String }]
});

const SystemSettingsSchema = new mongoose.Schema({
  // Company Profile & Localization
  companyName:     { type: String, default: 'BizzBuzz Creations' },
  companyLogo:     { type: String, default: '' },
  defaultTimezone: { type: String, default: 'Asia/Kolkata' },
  defaultCurrency: { type: String, default: 'USD' },
  dateFormat:      { type: String, default: 'YYYY-MM-DD' },
  timeFormat:      { type: String, default: '12h' },

  // Billing & Subscription
  subscriptionPlan:    { type: String, default: 'Enterprise Growth' },
  subscriptionStatus:  { type: String, default: 'Active' },
  billingLimitApi:     { type: Number, default: 50000 },
  billingLimitStorage: { type: Number, default: 100 }, // in GB

  // Security & Authentication
  passwordComplexity:  { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  sessionTimeout:      { type: Number, default: 120 }, // minutes
  enforce2FA:          { type: Boolean, default: false },
  ipWhitelist:         [{ type: String }],

  // Lead & Pipeline Stages
  pipelines: {
    type: [PipelineSchema],
    default: [{
      name: 'Sales Funnel',
      stages: [
        { name: 'Lead Generated', color: '#3b82f6', probability: 20 },
        { name: 'Contacted', color: '#f59e0b', probability: 40 },
        { name: 'Proposal Sent', color: '#8b5cf6', probability: 70 },
        { name: 'Negotiation', color: '#ec4899', probability: 90 },
        { name: 'Closed Won', color: '#10b981', probability: 100 },
        { name: 'Closed Lost', color: '#ef4444', probability: 0 }
      ],
      lostReasons: ['Pricing too high', 'Went with competitor', 'Product feature gap', 'No budget'],
      wonReasons: ['Best solution match', 'Competitive pricing', 'Great relationships', 'Quick delivery']
    }]
  },

  // Custom Fields Configuration
  customFields: {
    type: [CustomFieldSchema],
    default: []
  },

  // Dynamic Teams, Roles & Departments list
  roles: {
    type: [SystemRoleSchema],
    default: [
      { name: 'admin', label: 'Admin', permissions: ['all'] },
      { name: 'manager', label: 'Manager', permissions: ['manage_teams', 'view_reports', 'edit_leads'] },
      { name: 'member', label: 'Member', permissions: ['view_tasks', 'edit_own_tasks'] }
    ]
  },
  departments: {
    type: [String],
    default: ['Management', 'Sales', 'Engineering', 'Marketing', 'Support', 'General']
  },
  positions: {
    type: [String],
    default: ['Developer', 'Graphic Designer', 'Video Editor', 'SEO', 'HR', 'BDE', 'SMM', 'Other']
  },
  industries: {
    type: [String],
    default: ['Technology', 'Retail', 'Marketing', 'Finance', 'Healthcare', 'Education', 'Real Estate', 'Other']
  },
  teams: {
    type: [{
      name: { type: String, required: true },
      description: { type: String, default: '' }
    }],
    default: [
      { name: 'Sales Team East', description: 'East coast outreach and growth' },
      { name: 'Engineering Core', description: 'Core product engineers' },
      { name: 'Support Squad', description: 'Global client support team' }
    ]
  },

  // Task & Lead Assignment Rules
  assignmentRules: {
    leadDistribution:    { type: String, enum: ['none', 'round-robin', 'least-loaded'], default: 'round-robin' },
    activeSalesRepsOnly: { type: Boolean, default: true }
  },

  // Shared Templates
  emailTemplates: {
    type: [{
      name:    { type: String, required: true },
      subject: { type: String, required: true },
      body:    { type: String, required: true }
    }],
    default: [
      { name: 'Welcome Email', subject: 'Welcome to BizzBuzz!', body: 'Hi {{name}},\n\nThank you for choosing us! We are thrilled to partner with you.\n\nBest,\n{{sender}}' },
      { name: 'Meeting Follow Up', subject: 'Follow up on our discussion', body: 'Hi {{name}},\n\nIt was great speaking with you today. As discussed, here are the next steps...\n\nWarm regards,\n{{sender}}' }
    ]
  },
  snippetLibrary: {
    type: [{
      trigger: { type: String, required: true },
      text:    { type: String, required: true }
    }],
    default: [
      { trigger: ';greet', text: 'Thank you for reaching out to BizzBuzz support. How can I help you today?' },
      { trigger: ';close', text: 'If you have any further questions, please let us know. Have a wonderful day!' }
    ]
  },

  // Integrations config
  integrations: {
    slackEnabled:                { type: Boolean, default: false },
    slackWebhookUrl:             { type: String, default: '' },
    voipEnabled:                 { type: Boolean, default: false },
    marketingAutomationEnabled:  { type: Boolean, default: false }
  },

  // Import/Export Control
  dataControl: {
    allowBulkImport:    { type: Boolean, default: true },
    allowExportClients: { type: Boolean, default: true },
    allowExportTasks:   { type: Boolean, default: true }
  }
}, { timestamps: true });

module.exports = mongoose.model('SystemSettings', SystemSettingsSchema);
