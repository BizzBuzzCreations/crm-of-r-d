const mongoose = require('mongoose');
const { logger } = require('../utils/sysLogger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    logger.info('DB', `MongoDB connected: ${conn.connection.host}`);

    // Self-healing: reset stale presence on server bootup. Deliberately does
    // NOT touch WorkLog anymore (see history — it used to also force
    // active/breakActive false on every restart). A server restart is not
    // evidence anyone actually stopped working: it happens on every deploy,
    // and during a crash-loop (e.g. an EADDRINUSE port conflict) it can fire
    // repeatedly in quick succession, each time force-stopping every
    // currently-running timer in the building. The frontend's own timer
    // (useAppStore's tickTimer/localStorage-backed s.timer) already survives
    // socket disconnects/reconnects correctly on its own — see the explicit
    // "socket disconnect must never touch active" invariant there — so nothing
    // here needs to "fix" it by wiping the DB out from under an active session.
    // Presence is different: it's cosmetic and self-corrects within seconds
    // once a client's socket reconnects, so resetting it to a safe default on
    // boot is harmless (a client that's genuinely still connected will just
    // flip itself back to 'online' immediately via the normal connect flow).
    try {
      const User = mongoose.model('User');
      const Channel = mongoose.model('Channel');

      const userResult = await User.updateMany({}, { status: 'offline' });
      console.log(`🧹 Presence Self-Healing: Reset ${userResult.modifiedCount} user statuses to offline`);

      // Dynamic Channel seeding
      const channelCount = await Channel.countDocuments({});
      if (channelCount === 0) {
        await Channel.create([
          { name: 'general', description: 'Company-wide announcements' },
          { name: 'design', description: 'Design team discussions' },
          { name: 'development', description: 'Engineering updates' },
          { name: 'marketing', description: 'Marketing and campaigns' },
          { name: 'client-updates', description: 'Client status updates' },
        ]);
        console.log('🌱 Seeded 5 default channels into MongoDB');
      }

      // SystemSettings migration — ensure all required fields exist in the document
      const SystemSettings = mongoose.model('SystemSettings');
      const SETTINGS_DEFAULTS = {
        departments: ['Management', 'Sales', 'Engineering', 'Marketing', 'Support', 'General'],
        positions:   ['Developer', 'Graphic Designer', 'Video Editor', 'SEO', 'HR', 'BDE', 'SMM', 'Other'],
        industries:  ['Technology', 'Retail', 'Marketing', 'Finance', 'Healthcare', 'Education', 'Real Estate', 'Other'],
      };

      let settingsDoc = await SystemSettings.findOne().lean();
      if (!settingsDoc) {
        // No document at all — create with full defaults
        await SystemSettings.create({});
        console.log('🌱 SystemSettings: Created default document');
      } else {
        // Document exists — patch any missing or empty fields using raw MongoDB update
        const patch = {};
        for (const [field, defaultValue] of Object.entries(SETTINGS_DEFAULTS)) {
          if (!settingsDoc[field] || settingsDoc[field].length === 0) {
            patch[field] = defaultValue;
          }
        }
        if (Object.keys(patch).length > 0) {
          await SystemSettings.updateOne({ _id: settingsDoc._id }, { $set: patch });
          console.log(`🔧 SystemSettings: Patched missing fields → ${Object.keys(patch).join(', ')}`);
        } else {
          console.log('✅ SystemSettings: All fields present, no migration needed');
        }
      }

      // Task self-healing: assign sequential taskNumbers to any task without one
      const Task = mongoose.model('Task');
      const Counter = mongoose.model('Counter');
      const unnumberedTasks = await Task.find({ taskNumber: { $exists: false } }).sort({ createdAt: 1 });
      if (unnumberedTasks.length > 0) {
        console.log(`🧹 Task Self-Healing: Found ${unnumberedTasks.length} tasks without a task number`);
        let counter = await Counter.findOne({ id: 'taskNumber' });
        let nextSeq = counter ? counter.seq : 0;
        for (const task of unnumberedTasks) {
          nextSeq += 1;
          task.taskNumber = nextSeq;
          await task.save();
        }
        await Counter.findOneAndUpdate(
          { id: 'taskNumber' },
          { seq: nextSeq },
          { new: true, upsert: true }
        );
        console.log(`🧹 Task Self-Healing: Assigned sequence numbers up to #${nextSeq} successfully`);
      }

      // Lead leadId counter migration — Lead.getNextLeadNumber() switched
      // from a scan-and-compute-max approach (raced under concurrent
      // creates) to an atomic Counter increment. The shared Counter's seq
      // defaults to 0, so without this one-time seed the very next lead
      // created after this deploy would become LD-1, jumping backward past
      // whatever LD-#### leads already exist. No-ops on every boot after
      // the first, same idempotency as the Task counter above.
      const Lead = mongoose.model('Lead');
      const leadIdCounterExists = await Counter.findOne({ id: 'leadId' }).lean();
      if (!leadIdCounterExists) {
        const leadsWithIds = await Lead.find({ leadId: { $regex: /^LD-\d+$/ } }).select('leadId').lean();
        const maxLeadNum = leadsWithIds.reduce((max, l) => {
          const m = String(l.leadId || '').match(/^LD-(\d+)$/);
          return m ? Math.max(max, Number(m[1])) : max;
        }, 1000);
        await Counter.findOneAndUpdate(
          { id: 'leadId' },
          { $setOnInsert: { seq: maxLeadNum } },
          { upsert: true }
        );
        console.log(`🌱 Lead ID Counter: Seeded at ${maxLeadNum} (next lead will be LD-${maxLeadNum + 1})`);
      }
    } catch (err) {
      console.warn('⚠️ Startup self-healing skipped:', err.message);
    }
  } catch (err) {
    console.error(`❌ MongoDB connection failed: ${err.message}`);
    console.error('   Make sure MongoDB is running or MONGO_URI is correct in .env');
    logger.error('DB', `MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
