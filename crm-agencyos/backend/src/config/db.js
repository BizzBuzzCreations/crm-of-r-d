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
