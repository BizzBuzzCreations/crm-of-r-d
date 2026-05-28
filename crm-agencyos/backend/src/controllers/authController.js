const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// Send tokens helper
const sendTokens = (user, statusCode, res) => {
  const accessToken  = user.getAccessToken();
  const refreshToken = user.getRefreshToken();

  const cookieOpts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  res
    .cookie('refreshToken', refreshToken, { ...cookieOpts, maxAge: 7*24*60*60*1000 })
    .status(statusCode)
    .json({
      success: true,
      accessToken,
      user: {
        _id:        user._id,
        id:         user._id,
        name:       user.name,
        email:      user.email,
        role:       user.role,
        position:   user.position,
        department: user.department,
        phone:      user.phone,
        color:      user.color,
        initials:   user.initials,
        status:     user.status,
        joinDate:   user.joinDate,
        bio:        user.bio,
        avatar:     user.avatar,
        emailSync:  user.emailSync,
        calendarSyncEnabled: user.calendarSyncEnabled,
        notificationPrefs:   user.notificationPrefs,
        personalSignature:   user.personalSignature,
        defaultLandingView:  user.defaultLandingView,
      },
    });
};

// @POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const match = await user.matchPassword(password);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    // Mark online
    user.status = 'online';
    await user.save({ validateBeforeSave: false });

    sendTokens(user, 200, res);
  } catch (err) { next(err); }
};

// @POST /api/auth/logout
exports.logout = async (req, res, next) => {
  try {
    let userId = null;
    let token = null;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.id) {
          userId = decoded.id;
        }
      } catch (err) {
        // Ignore token decoding errors on logout
      }
    }

    if (userId) {
      await User.findByIdAndUpdate(userId, { status: 'offline' });
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    res.json({ success: true, message: 'Logged out' });
  } catch (err) { next(err); }
};

// @POST /api/auth/refresh
exports.refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: 'No refresh token' });

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user    = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    sendTokens(user, 200, res);
  } catch (err) {
    res.clearCookie('refreshToken');
    return res.status(401).json({ success: false, message: 'Refresh token expired, please login again' });
  }
};

// @GET /api/auth/me
exports.me = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// @PUT /api/auth/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, email, position, phone, bio, color, emailSync, calendarSyncEnabled, notificationPrefs, personalSignature, defaultLandingView } = req.body;
    const updateObj = {};
    if (name !== undefined) updateObj.name = name;
    if (email !== undefined) updateObj.email = email;
    if (position !== undefined) updateObj.position = position;
    if (phone !== undefined) updateObj.phone = phone;
    if (bio !== undefined) updateObj.bio = bio;
    if (color !== undefined) updateObj.color = color;
    if (emailSync !== undefined) updateObj.emailSync = emailSync;
    if (calendarSyncEnabled !== undefined) updateObj.calendarSyncEnabled = calendarSyncEnabled;
    if (notificationPrefs !== undefined) updateObj.notificationPrefs = notificationPrefs;
    if (personalSignature !== undefined) updateObj.personalSignature = personalSignature;
    if (defaultLandingView !== undefined) updateObj.defaultLandingView = defaultLandingView;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateObj,
      { new: true, runValidators: true }
    );

    // Broadcast update for real-time presence/visual sync
    const io = req.app.get('io');
    io?.emit('user:updated', user);

    res.json({ success: true, user });
  } catch (err) { next(err); }
};

// @PUT /api/auth/password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    const match = await user.matchPassword(currentPassword);
    if (!match) return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) { next(err); }
};
