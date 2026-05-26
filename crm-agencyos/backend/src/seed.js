const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User     = require('./models/User');

// ── Admin accounts to create ──────────────────────────────────
// Edit these before running on the server
const ADMINS = [
  {
    name:       'bizzbuzzcreations',
    email:      'dev@bizzbuzzcreations.com',
    password:   'bbc655',
    role:       'admin',
    position:   'CEO & Founder',
    department: 'Management',
    color:      '#7C3AED',
    joinDate:   'May 26, 2026',
    phone:      '+91 00000 00000',
    bio:        'Leading the agency vision and strategy.',
    status:     'offline',
  },
];

async function createAdmins() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    for (const adminData of ADMINS) {
      const existing = await User.findOne({ email: adminData.email });

      if (existing) {
        console.log(`⚠️  Skipped  — ${adminData.email} already exists (not modified)`);
      } else {
        await User.create(adminData);
        console.log(`✅ Created  — ${adminData.name} (${adminData.email}) [${adminData.role}]`);
      }
    }

    console.log('\n🎉 Done. Admin accounts are ready.');
    console.log('─────────────────────────────────────');
    console.log('Login credentials:');
    ADMINS.forEach((a) => {
      console.log(`  Email:    ${a.email}`);
      console.log(`  Password: ${a.password}`);
      console.log('');
    });

  } catch (err) {
    console.error('❌ Failed:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdmins();
