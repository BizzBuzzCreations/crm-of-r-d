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
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { status: 'offline' });
    }
    res.clearCookie('refreshToken');
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
    const { name, email, position, phone, bio } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email, position, phone, bio },
      { new: true, runValidators: true }
    );
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
