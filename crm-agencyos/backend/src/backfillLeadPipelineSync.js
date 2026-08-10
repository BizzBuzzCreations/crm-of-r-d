const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const CampaignLead = require('./models/CampaignLead');
const Lead = require('./models/Lead');
const { syncCampaignLeadToPipeline } = require('./utils/leadPipelineSync');
const { HOT_OPEN_THRESHOLD } = require('./utils/campaignConstants');

// One-time backfill: syncs pre-existing campaign engagement (opened 3+ times,
// or already replied) into the B2B Leads Pipeline. Only needed once, to catch
// up leads that hit these thresholds BEFORE the auto-sync feature existed —
// going forward, trackingController.js and campaignController.js do this live
// on every new qualifying open/reply. Safe to re-run; syncCampaignLeadToPipeline
// matches by email and updates in place rather than duplicating.
const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to ${process.env.MONGO_URI}`);
  console.log(DRY_RUN ? '[DRY RUN — no writes will happen]\n' : '[LIVE — will write to the database]\n');

  const qualifying = await CampaignLead.find({
    $or: [
      { openCount: { $gte: HOT_OPEN_THRESHOLD } },
      { status: 'replied' },
    ],
  });

  console.log(`Found ${qualifying.length} campaign lead(s) that already qualify.\n`);

  let hotOnly = 0, repliedOnly = 0, both = 0, failed = 0;
  const leadCountBefore = await Lead.countDocuments({});

  for (const cl of qualifying) {
    const isHot = (cl.openCount || 0) >= HOT_OPEN_THRESHOLD;
    const isReplied = cl.status === 'replied';
    if (isHot && isReplied) both++;
    else if (isHot) hotOnly++;
    else repliedOnly++;

    console.log(`  ${cl.email} — opens: ${cl.openCount || 0}, status: ${cl.status}`);

    if (DRY_RUN) continue;

    try {
      // Replied first so a lead that both replied AND opened 3+ times lands
      // on the more accurate "First Contact" status, not "New Lead".
      if (isReplied) await syncCampaignLeadToPipeline(cl, 'replied');
      if (isHot) await syncCampaignLeadToPipeline(cl, 'hot');
    } catch (err) {
      failed++;
      console.error(`    ✗ failed: ${err.message}`);
    }
  }

  console.log(`\nBreakdown: ${hotOnly} hot-only, ${repliedOnly} replied-only, ${both} both.`);

  if (!DRY_RUN) {
    const leadCountAfter = await Lead.countDocuments({});
    console.log(`Leads pipeline: ${leadCountBefore} -> ${leadCountAfter} (${leadCountAfter - leadCountBefore} net new)`);
    if (failed) console.log(`${failed} failed — see errors above.`);
  } else {
    console.log('\nRe-run without --dry-run to actually apply these.');
  }

  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
