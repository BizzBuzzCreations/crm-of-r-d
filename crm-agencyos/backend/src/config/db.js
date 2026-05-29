const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    // Self-healing: Reset all active user presence statuses and worklogs on server bootup
    try {
      const User = mongoose.model('User');
      const WorkLog = mongoose.model('WorkLog');
      const Channel = mongoose.model('Channel');
      
      const userResult = await User.updateMany({}, { status: 'offline' });
      console.log(`🧹 Presence Self-Healing: Reset ${userResult.modifiedCount} user statuses to offline`);

      const today = new Date().toISOString().split('T')[0];
      const logResult = await WorkLog.updateMany({ date: today }, { active: false, breakActive: false });
      console.log(`🧹 WorkLog Self-Healing: Deactivated ${logResult.modifiedCount} worklogs for today (${today})`);

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
    } catch (err) {
      console.warn('⚠️ Startup self-healing skipped:', err.message);
    }
  } catch (err) {
    console.error(`❌ MongoDB connection failed: ${err.message}`);
    console.error('   Make sure MongoDB is running or MONGO_URI is correct in .env');
    process.exit(1);
  }
};

module.exports = connectDB;
