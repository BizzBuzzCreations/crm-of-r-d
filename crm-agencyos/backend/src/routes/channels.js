const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const xtra = require('../controllers/extraControllers');

const router = express.Router();
router.use(protect);

router.get('/',       xtra.getChannels);
router.post('/',      authorize('admin'), xtra.createChannel);
router.put('/:id',    authorize('admin'), xtra.updateChannel);
router.delete('/:id', authorize('admin'), xtra.deleteChannel);

module.exports = router;
