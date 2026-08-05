'use strict';
// Every API domain that the MAIN CRM (or any other external system) calls
// into rndCRM lives under here, one folder per domain — see README.md in
// this directory for the pattern to add a new one (e.g. campaignSync,
// todoSync, taskSync). This file just collects them so app.js has one
// require instead of one per domain; each domain still owns its own base
// path, mounted individually below.
module.exports = {
  leadSync: require('./leadSync/leadSync.routes'),
  // campaignSync: require('./campaignSync/campaignSync.routes'),
  // todoSync:     require('./todoSync/todoSync.routes'),
  // taskSync:     require('./taskSync/taskSync.routes'),
};
