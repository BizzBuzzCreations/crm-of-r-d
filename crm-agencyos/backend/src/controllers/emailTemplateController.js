'use strict';
const EmailTemplate = require('../models/EmailTemplate');

const isPrivileged = (role) => role === 'admin' || role === 'manager';

// GET /api/email-templates — shared library, visible to anyone with campaign access
exports.getTemplates = async (req, res, next) => {
  try {
    const templates = await EmailTemplate.find({ isDeleted: { $ne: true } })
      .populate('owner', 'name email')
      .sort({ updatedAt: -1 });
    res.json({ success: true, data: templates });
  } catch (err) { next(err); }
};

// POST /api/email-templates
exports.createTemplate = async (req, res, next) => {
  try {
    const { name, subject, bodyHtml } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Template name is required' });

    const template = await EmailTemplate.create({
      name, subject: subject || '', bodyHtml: bodyHtml || '',
      owner: req.user._id,
    });
    const populated = await EmailTemplate.findById(template._id).populate('owner', 'name email');
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

// PUT /api/email-templates/:id — owner, or an admin/manager, may edit
exports.updateTemplate = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    if (String(template.owner) !== String(req.user._id) && !isPrivileged(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You can only edit templates you created' });
    }

    const { name, subject, bodyHtml } = req.body;
    if (name !== undefined) template.name = name;
    if (subject !== undefined) template.subject = subject;
    if (bodyHtml !== undefined) template.bodyHtml = bodyHtml;
    await template.save();

    const populated = await EmailTemplate.findById(template._id).populate('owner', 'name email');
    res.json({ success: true, data: populated });
  } catch (err) { next(err); }
};

// DELETE /api/email-templates/:id
exports.deleteTemplate = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    if (String(template.owner) !== String(req.user._id) && !isPrivileged(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You can only delete templates you created' });
    }
    template.isDeleted = true;
    await template.save();
    res.json({ success: true, data: { _id: template._id } });
  } catch (err) { next(err); }
};
