require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('./models/User');
const { Client, Task, Todo, Meeting } = require('./models/index');

const SEED_USERS = [
  {
    name:       'Alex Johnson',
    email:      'admin@agency.com',
    password:   'admin123',
    role:       'admin',
    position:   'CEO & Founder',
    department: 'Management',
    color:      '#7C3AED',
    joinDate:   'Jan 15, 2021',
    phone:      '+1 (234) 567-8901',
    bio:        'Leading the agency vision and strategy.',
    status:     'offline',
  },
  {
    name:       'Sarah Chen',
    email:      'manager@agency.com',
    password:   'manager123',
    role:       'manager',
    position:   'Project Manager',
    department: 'Operations',
    color:      '#0EA5E9',
    joinDate:   'Mar 20, 2021',
    phone:      '+1 (234) 567-8902',
    bio:        'Managing client projects and driving team performance.',
    status:     'offline',
  },
  {
    name:       'Mike Davis',
    email:      'member@agency.com',
    password:   'member123',
    role:       'member',
    position:   'Senior Developer',
    department: 'Engineering',
    color:      '#10B981',
    joinDate:   'Jun 10, 2021',
    phone:      '+1 (234) 567-8903',
    bio:        'Full-stack developer specializing in React and Node.js.',
    status:     'offline',
  },
  {
    name:       'Emma Wilson',
    email:      'emma@agency.com',
    password:   'member123',
    role:       'member',
    position:   'UI/UX Designer',
    department: 'Design',
    color:      '#F59E0B',
    joinDate:   'Jan 5, 2022',
    phone:      '+1 (234) 567-8904',
    bio:        'Creating beautiful, functional interfaces.',
    status:     'offline',
  },
  {
    name:       'James Brown',
    email:      'james@agency.com',
    password:   'member123',
    role:       'member',
    position:   'Content Strategist',
    department: 'Marketing',
    color:      '#EF4444',
    joinDate:   'Apr 15, 2022',
    phone:      '+1 (234) 567-8905',
    bio:        'Crafting compelling content strategies.',
    status:     'offline',
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Client.deleteMany({}),
      Task.deleteMany({}),
      Todo.deleteMany({}),
      Meeting.deleteMany({}),
    ]);
    console.log('🗑️  Cleared existing data');

    // Create users (password hashing happens in pre-save hook)
    const users = await User.create(SEED_USERS);
    console.log(`👥 Created ${users.length} users`);

    const admin   = users.find((u) => u.role === 'admin');
    const manager = users.find((u) => u.role === 'manager');
    const members = users.filter((u) => u.role === 'member');
    const mike    = members[0];
    const emma    = members[1];
    const james   = members[2];

    // Seed meetings
    await Meeting.create([
      {
        title:    'Weekly Team Standup',
        type:     'internal',
        date:     new Date().toISOString().split('T')[0],
        time:     '09:00',
        duration: '30 min',
        status:   'upcoming',
        participants: users.map((u) => u._id),
        location: 'Google Meet',
        notes:    'Regular weekly sync.',
        meetingLink: 'https://meet.google.com/abc-defg-hij',
        createdBy: admin._id,
      },
    ]);
    console.log('📅 Seeded meetings');

    console.log('\n✨ Seed completed! Demo accounts:');
    SEED_USERS.forEach((u) => console.log(`   ${u.role.padEnd(10)} ${u.email} / ${u.password}`));
    console.log('');

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
