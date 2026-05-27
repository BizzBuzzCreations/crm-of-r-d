const router  = require('express').Router();
const { protect } = require('../middleware/auth');
const ctrl    = require('../controllers/notificationController');

router.get('/',           protect, ctrl.getNotifications);
router.patch('/read-all', protect, ctrl.markAllRead);
router.patch('/:id/read', protect, ctrl.markRead);
router.delete('/:id',     protect, ctrl.deleteNotification);

module.exports = router;
