const express = require('express');
const { protect, denyClientWrites } = require('../middleware/auth');
const { authorizeFeature } = require('../middleware/authorizeFeature');
const xtra = require('../controllers/extraControllers');

const router = express.Router();
router.use(protect);
router.use(denyClientWrites); // clients get read-only access

// Sub-resource of "Clients & Projects" — no separate nav item/featureKey,
// reuses the 'clients' key on its own mutation routes only (GET stays open,
// same reasoning as clientsRouter — see authorizeFeature.js / SystemSettings).
router.get('/',       xtra.getProjects);
router.post('/',      authorizeFeature('clients', ['admin','manager']), xtra.createProject);
router.put('/:id',    authorizeFeature('clients', ['admin','manager']), xtra.updateProject);
router.delete('/:id', authorizeFeature('clients', ['admin','manager']), xtra.deleteProject);

module.exports = router;
