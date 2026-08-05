'use strict';
const express = require('express');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const ctrl = require('./leadSync.controller');

const router = express.Router();
router.use(apiKeyAuth);
router.get('/pending',        ctrl.getPendingSyncLeads);
router.post('/status',        ctrl.syncLeadStatus);
router.get('/email-activity', ctrl.getLeadEmailActivity);

module.exports = router;
