'use strict';
// Implements the "Automatic Lead & Task Assignment Rules" panel in
// Settings > Lead Routing (SystemSettings.assignmentRules). Only decides
// WHO an incoming lead should go to — callers still own actually setting
// assignedTo, logging the activity note, and notifying the rep, exactly
// like a manual assignment does.
const User = require('../models/User');
const Lead = require('../models/Lead');
const { SystemSettings, Counter } = require('../models/index');

// Portal clients (role 'client') are never sales reps. 'deleted' isn't in
// the User status enum today but other code in this codebase already
// guards against it (see leadController's mention-parsing) — kept here too
// in case a future soft-delete convention lands on User the same way.
async function getEligibleReps(activeOnly) {
  const statusExclude = activeOnly ? ['deleted', 'offline'] : ['deleted'];
  return User.find({ role: { $ne: 'client' }, status: { $nin: statusExclude } })
    .select('_id')
    .sort({ _id: 1 })
    .lean();
}

async function pickRoundRobin(reps) {
  const counter = await Counter.findOneAndUpdate(
    { id: 'leadRoundRobin' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return reps[counter.seq % reps.length]._id;
}

async function pickLeastLoaded(reps) {
  const openCounts = await Lead.aggregate([
    { $match: { assignedTo: { $in: reps.map((r) => r._id) }, status: { $nin: ['Won', 'Lost'] } } },
    { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(openCounts.map((c) => [String(c._id), c.count]));

  let best = reps[0];
  let bestCount = countMap.get(String(best._id)) || 0;
  for (const rep of reps.slice(1)) {
    const c = countMap.get(String(rep._id)) || 0;
    if (c < bestCount) { best = rep; bestCount = c; }
  }
  return best._id;
}

// Returns a userId to auto-assign an incoming lead to, or null when
// auto-distribution is off ('none') or there's no eligible rep — callers
// treat null exactly like "nobody picked, leave it unassigned."
async function autoAssignLead() {
  try {
    const settings = await SystemSettings.findOne().select('assignmentRules').lean();
    const rules = settings?.assignmentRules || {};
    const algorithm = rules.leadDistribution || 'none';
    if (algorithm === 'none') return null;

    const reps = await getEligibleReps(rules.activeSalesRepsOnly !== false);
    if (!reps.length) return null;

    if (algorithm === 'least-loaded') return await pickLeastLoaded(reps);
    return await pickRoundRobin(reps); // default / 'round-robin'
  } catch (err) {
    console.error('[LeadAssignment] auto-assign failed:', err.message);
    return null;
  }
}

module.exports = { autoAssignLead };
