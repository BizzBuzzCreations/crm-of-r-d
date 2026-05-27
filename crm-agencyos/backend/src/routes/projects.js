const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const xtra = require('../controllers/extraControllers');

const router = express.Router();
router.use(protect);

router.get('/',       xtra.getProjects);
router.post('/',      authorize('admin','manager'), xtra.createProject);
router.put('/:id',    authorize('admin','manager'), xtra.updateProject);
router.delete('/:id', authorize('admin','manager'), xtra.deleteProject);

module.exports = router;
