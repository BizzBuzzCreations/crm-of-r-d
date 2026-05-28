const { SystemSettings } = require('../models/index');
const User = require('../models/User');

// Defaults that must exist in every document — used to patch legacy docs
const FIELD_DEFAULTS = {
  departments: ['Management', 'Sales', 'Engineering', 'Marketing', 'Support', 'General'],
  positions:   ['Developer', 'Graphic Designer', 'Video Editor', 'SEO', 'HR', 'BDE', 'SMM', 'Other'],
  industries:  ['Technology', 'Retail', 'Marketing', 'Finance', 'Healthcare', 'Education', 'Real Estate', 'Other'],
};

// @GET /api/settings
exports.getSystemSettings = async (req, res, next) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
      return res.json({ success: true, data: settings });
    }

    // Use .lean() raw data to accurately detect fields missing from legacy documents
    const rawSettings = settings.toObject();
    const missing = {};
    for (const [field, defaultValue] of Object.entries(FIELD_DEFAULTS)) {
      if (!Object.prototype.hasOwnProperty.call(rawSettings, field) || !rawSettings[field] || rawSettings[field].length === 0) {
        missing[field] = defaultValue;
      }
    }
    if (Object.keys(missing).length > 0) {
      settings = await SystemSettings.findByIdAndUpdate(
        settings._id,
        { $set: missing },
        { new: true }
      );
    }

    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
};

// @PUT /api/settings
exports.updateSystemSettings = async (req, res, next) => {
  try {
    const role = req.user.role;
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
    }

    let updateData = { ...req.body };

    // Manager role checks: Restrict manager from updating global/system tier fields
    if (role === 'manager') {
      const allowedManagerFields = [
        'departments',
        'positions',
        'industries',
        'teams',
        'assignmentRules',
        'emailTemplates',
        'snippetLibrary',
        'integrations',
        'dataControl'
      ];
      
      // Delete any keys not in the allowed list
      Object.keys(updateData).forEach((key) => {
        if (!allowedManagerFields.includes(key)) {
          delete updateData[key];
        }
      });
    }

    // Apply updates
    const updatedSettings = await SystemSettings.findByIdAndUpdate(
      settings._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // Broadcast live update to all sockets for real-time config sync!
    const io = req.app.get('io');
    io?.emit('settings:updated', updatedSettings);

    res.json({ success: true, data: updatedSettings });
  } catch (err) { next(err); }
};

// @POST /api/settings/users (Dynamic Invite/Create member)
exports.inviteUser = async (req, res, next) => {
  try {
    const { name, email, role, position, department, color, phone } = req.body;
    
    // Check if user already exists
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    // Setup initials
    const initials = name ? name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2) : 'U';

    // Create user with a secure default password 'welcome123'
    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      role: role || 'member',
      position: position || 'Team Member',
      department: department || 'General',
      color: color || '#6366f1',
      phone: phone || '',
      initials,
      joinDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      password: 'welcome123', // Default welcome password, they can update in personal security tab
      status: 'offline'
    });

    // Broadcast new user created to all clients
    const io = req.app.get('io');
    io?.emit('user:updated', newUser);

    res.status(201).json({ success: true, data: newUser });
  } catch (err) { next(err); }
};
