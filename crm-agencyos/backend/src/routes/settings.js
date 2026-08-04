const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/settingsController');

// All settings routes are protected
router.use(protect);

router.route('/')
  .get(ctrl.getSystemSettings)
  .put(authorize('admin', 'manager'), ctrl.updateSystemSettings);

router.route('/users')
  .post(authorize('admin', 'manager'), ctrl.inviteUser);

router.get('/assignment-sheet-test', authorize('admin', 'manager'), ctrl.testAssignmentSheet);

module.exports = router;
