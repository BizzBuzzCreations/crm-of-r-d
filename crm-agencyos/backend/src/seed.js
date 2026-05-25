const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User     = require('./models/User');
const { 
  Client, Task, Todo, Meeting, MeetingInvitation, Revenue, WorkLog, Message 
} = require('./models/index');

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
    name:       'Tejash Yadav',
    email:      'tejash@gmail.com',
    password:   'tejash',
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

// Date helpers
const daysAgo = (num) => {
  const d = new Date();
  d.setDate(d.getDate() - num);
  return d;
};

const daysFromNow = (num) => {
  const d = new Date();
  d.setDate(d.getDate() + num);
  return d;
};

// Format as YYYY-MM-DD
const fmtDate = (d) => d.toISOString().split('T')[0];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Client.deleteMany({}),
      Task.deleteMany({}),
      Todo.deleteMany({}),
      Meeting.deleteMany({}),
      MeetingInvitation.deleteMany({}),
      Revenue.deleteMany({}),
      WorkLog.deleteMany({}),
      Message.deleteMany({}),
    ]);
    console.log('🗑️  Cleared existing data of all collections');

    // 2. Create users (password hashing happens in pre-save hook)
    const users = await User.create(SEED_USERS);
    console.log(`👥 Created ${users.length} users with hashed credentials`);

    const admin   = users.find((u) => u.role === 'admin');
    const manager = users.find((u) => u.role === 'manager');
    const members = users.filter((u) => u.role === 'member');
    const mike    = members[0];
    const emma    = members[1];
    const james   = members[2];

    // 3. Seed Clients (8 diverse corporations, onboarding dates distributed)
    const clientDocs = [
      {
        name:             'TechCorp Solutions',
        contact:          'Robert Downey',
        email:            'robert@techcorp.com',
        phone:            '+1 (555) 019-2831',
        website:          'https://techcorp.com',
        industry:         'Software & SaaS',
        address:          '100 Silicon Blvd, San Jose, CA',
        services:         ['Web Development', 'UI/UX Design'],
        budget:           '$15,000',
        contractDuration: '12 months',
        status:           'active',
        paymentStatus:    'paid',
        projectCount:     3,
        onboardingDate:   fmtDate(daysAgo(48)),
        assignedTeam:     [mike._id, emma._id],
        createdBy:        admin._id,
        createdAt:        daysAgo(48),
      },
      {
        name:             'Acme Global',
        contact:          'Wile E. Coyote',
        email:            'coyote@acme.com',
        phone:            '+1 (555) 012-9844',
        website:          'https://acme.com',
        industry:         'Manufacturing',
        address:          '50 Desert Rd, Phoenix, AZ',
        services:         ['SEO', 'Content Strategy'],
        budget:           '$8,000',
        contractDuration: '6 months',
        status:           'active',
        paymentStatus:    'pending',
        projectCount:     1,
        onboardingDate:   fmtDate(daysAgo(35)),
        assignedTeam:     [james._id],
        createdBy:        manager._id,
        createdAt:        daysAgo(35),
      },
      {
        name:             'Delta Ventures',
        contact:          'Steve Rogers',
        email:            'rogers@deltav.com',
        phone:            '+1 (555) 014-4822',
        website:          'https://deltaventures.com',
        industry:         'Finance',
        address:          '1 Wall St, New York, NY',
        services:         ['Mobile App Development'],
        budget:           '$24,000',
        contractDuration: '18 months',
        status:           'active',
        paymentStatus:    'paid',
        projectCount:     2,
        onboardingDate:   fmtDate(daysAgo(22)),
        assignedTeam:     [mike._id, emma._id],
        createdBy:        admin._id,
        createdAt:        daysAgo(22),
      },
      {
        name:             'GlobalBiz Agency',
        contact:          'Natasha Romanoff',
        email:            'romanoff@globalbiz.com',
        phone:            '+1 (555) 017-7491',
        services:         ['Content Marketing'],
        budget:           '$6,500',
        contractDuration: '3 months',
        status:           'on-hold',
        paymentStatus:    'overdue',
        projectCount:     1,
        onboardingDate:   fmtDate(daysAgo(14)),
        assignedTeam:     [james._id],
        createdBy:        manager._id,
        createdAt:        daysAgo(14),
      },
      {
        name:             'SparkMedia Networks',
        contact:          'Tony Stark',
        email:            'tony@sparkmedia.net',
        phone:            '+1 (555) 015-8493',
        website:          'https://sparkmedia.net',
        industry:         'Entertainment',
        services:         ['UI/UX Redesign', 'Branding'],
        budget:           '$12,500',
        contractDuration: '12 months',
        status:           'active',
        paymentStatus:    'paid',
        projectCount:     2,
        onboardingDate:   fmtDate(daysAgo(5)),
        assignedTeam:     [emma._id],
        createdBy:        admin._id,
        createdAt:        daysAgo(5),
      },
    ];

    const insertedClients = await Client.collection.insertMany(clientDocs);
    const clients = await Client.find();
    console.log(`💼 Seeded ${clients.length} clients with custom onboarding timelines`);

    const techcorp = clients.find(c => c.name === 'TechCorp Solutions');
    const acme = clients.find(c => c.name === 'Acme Global');
    const delta = clients.find(c => c.name === 'Delta Ventures');
    const globalbiz = clients.find(c => c.name === 'GlobalBiz Agency');
    const spark = clients.find(c => c.name === 'SparkMedia Networks');

    // 4. Seed Tasks (20 documents with historical creation dates)
    const taskDocs = [
      // TechCorp tasks
      {
        title:       'Database Schema Design',
        description: 'Design the primary MongoDB data models and compound indices.',
        assignedTo:  mike._id,
        assignedBy:  admin._id,
        clientId:    techcorp._id,
        type:        'client',
        dueDate:     fmtDate(daysAgo(40)),
        eta:         '4 days',
        priority:    'high',
        status:      'completed',
        progress:    100,
        tags:        ['Backend', 'Database'],
        createdAt:   daysAgo(45),
      },
      {
        title:       'UI Design Kit Creation',
        description: 'Develop the Figma dynamic design system for layouts.',
        assignedTo:  emma._id,
        assignedBy:  manager._id,
        clientId:    techcorp._id,
        type:        'client',
        dueDate:     fmtDate(daysAgo(35)),
        eta:         '6 days',
        priority:    'medium',
        status:      'completed',
        progress:    100,
        tags:        ['Figma', 'UI/UX'],
        createdAt:   daysAgo(42),
      },
      {
        title:       'API Route Implementations',
        description: 'Complete all REST endpoints and custom authorization filters.',
        assignedTo:  mike._id,
        assignedBy:  admin._id,
        clientId:    techcorp._id,
        type:        'client',
        dueDate:     fmtDate(daysAgo(15)),
        eta:         '10 days',
        priority:    'high',
        status:      'in-progress',
        progress:    65,
        tags:        ['Backend', 'Express'],
        createdAt:   daysAgo(25),
      },
      // Acme tasks
      {
        title:       'Competitor SEO Audit',
        description: 'Analyze keyword distributions for top 5 global competitors.',
        assignedTo:  james._id,
        assignedBy:  manager._id,
        clientId:    acme._id,
        type:        'client',
        dueDate:     fmtDate(daysAgo(20)),
        eta:         '5 days',
        priority:    'medium',
        status:      'completed',
        progress:    100,
        tags:        ['SEO', 'Marketing'],
        createdAt:   daysAgo(25),
      },
      {
        title:       'Initial Keyword Seeding',
        description: 'Launch first round of organic SEO tags in client pages.',
        assignedTo:  james._id,
        assignedBy:  manager._id,
        clientId:    acme._id,
        type:        'client',
        dueDate:     fmtDate(daysFromNow(5)),
        eta:         '8 days',
        priority:    'medium',
        status:      'pending',
        progress:    0,
        tags:        ['SEO', 'Optimization'],
        createdAt:   daysAgo(4),
      },
      // Delta tasks
      {
        title:       'React Native Boilerplate Configuration',
        description: 'Configure clean boilerplate structures and authentication routing.',
        assignedTo:  mike._id,
        assignedBy:  admin._id,
        clientId:    delta._id,
        type:        'client',
        dueDate:     fmtDate(daysAgo(10)),
        eta:         '3 days',
        priority:    'high',
        status:      'completed',
        progress:    100,
        tags:        ['Mobile', 'React Native'],
        createdAt:   daysAgo(15),
      },
      {
        title:       'Payment Gateway Gateways',
        description: 'Incorporate secure Stripe gateway configurations.',
        assignedTo:  mike._id,
        assignedBy:  admin._id,
        clientId:    delta._id,
        type:        'client',
        dueDate:     fmtDate(daysFromNow(12)),
        eta:         '7 days',
        priority:    'urgent',
        status:      'in-progress',
        progress:    40,
        tags:        ['Stripe', 'Security'],
        createdAt:   daysAgo(2),
      },
      // Spark tasks
      {
        title:       'Branding Assets Refactoring',
        description: 'Update client dynamic logos and color palettes.',
        assignedTo:  emma._id,
        assignedBy:  admin._id,
        clientId:    spark._id,
        type:        'client',
        dueDate:     fmtDate(daysFromNow(2)),
        eta:         '2 days',
        priority:    'low',
        status:      'sent-for-approval',
        progress:    95,
        tags:        ['Design', 'Branding'],
        createdAt:   daysAgo(5),
      },
      // In-house tasks
      {
        title:       'Internal CI/CD Pipeline Setup',
        description: 'Configure automated testing pipelines and staging builds.',
        assignedTo:  mike._id,
        assignedBy:  admin._id,
        type:        'inhouse',
        dueDate:     fmtDate(daysAgo(8)),
        eta:         '4 days',
        priority:    'high',
        status:      'completed',
        progress:    100,
        tags:        ['DevOps', 'CI/CD'],
        createdAt:   daysAgo(12),
      },
      {
        title:       'Website Dark Mode Overhaul',
        description: 'Ensure maximum contrast and Harmonious color schemes across pages.',
        assignedTo:  emma._id,
        assignedBy:  manager._id,
        type:        'inhouse',
        dueDate:     fmtDate(daysFromNow(18)),
        eta:         '14 days',
        priority:    'low',
        status:      'pending',
        progress:    15,
        tags:        ['Frontend', 'CSS'],
        createdAt:   daysAgo(1),
      },
    ];

    await Task.collection.insertMany(taskDocs);
    console.log('📝 Seeded 10 detailed tasks across past and future dates');

    // 5. Seed Todos (40 records spread across the last 45 days to light up the dashboard heatmap)
    const todoDocs = [];
    const usersPool = [mike._id, emma._id, james._id, admin._id];
    
    // We want to seed completions on various days to create a beautiful, dynamic heatmap!
    for (let i = 0; i < 45; i++) {
      const date = daysAgo(i);
      const isCompleted = Math.random() > 0.35; // 65% completion rate for active glowing cells
      
      if (isCompleted) {
        // completed task/todo on this day
        const completionsCount = Math.floor(Math.random() * 4) + 1; // 1 to 4 completed items
        for (let j = 0; j < completionsCount; j++) {
          const assignedUser = usersPool[j % usersPool.length];
          todoDocs.push({
            title:     `Completed Task Task #${i}-${j}`,
            description:`Auto-generated todo completion description`,
            userId:    assignedUser,
            status:    'completed',
            createdAt: date,
            updatedAt: date
          });
        }
      } else {
        // Seed a few pending ones
        if (Math.random() > 0.7) {
          const assignedUser = usersPool[i % usersPool.length];
          todoDocs.push({
            title:     `Pending Task #${i}`,
            description:`Auto-generated pending todo`,
            userId:    assignedUser,
            status:    'pending',
            createdAt: date,
            updatedAt: date
          });
        }
      }
    }

    await Todo.collection.insertMany(todoDocs);
    console.log(`🔥 Seeded ${todoDocs.length} todos distributed over 45 days for dynamic Heatmap`);

    // 6. Seed Revenues (16 records historically grouped across Feb, Mar, Apr, May)
    const revenueDocs = [
      // February (Contract receipts)
      { amount: 45000,  currency: 'INR', source: 'Acme SEO retainer', status: 'received', processedBy: admin._id, date: daysAgo(95), createdAt: daysAgo(95) },
      { amount: 95000,  currency: 'INR', source: 'TechCorp SaaS milestone', status: 'received', processedBy: admin._id, date: daysAgo(90), createdAt: daysAgo(90) },
      { amount: 150000, currency: 'INR', source: 'Delta Ventures Consultation', status: 'received', processedBy: admin._id, date: daysAgo(82), createdAt: daysAgo(82) },

      // March
      { amount: 55000,  currency: 'INR', source: 'Acme SEO retainer', status: 'received', processedBy: admin._id, date: daysAgo(68), createdAt: daysAgo(68) },
      { amount: 95000,  currency: 'INR', source: 'TechCorp SaaS milestone', status: 'received', processedBy: admin._id, date: daysAgo(62), createdAt: daysAgo(62) },
      { amount: 120000, currency: 'INR', source: 'SparkMedia Design retainer', status: 'received', processedBy: admin._id, date: daysAgo(58), createdAt: daysAgo(58) },
      { amount: 40000,  currency: 'INR', source: 'GlobalBiz retainer', status: 'pending', processedBy: admin._id, date: daysAgo(60), createdAt: daysAgo(60) },

      // April
      { amount: 55000,  currency: 'INR', source: 'Acme SEO retainer', status: 'received', processedBy: admin._id, date: daysAgo(38), createdAt: daysAgo(38) },
      { amount: 95000,  currency: 'INR', source: 'TechCorp SaaS milestone', status: 'received', processedBy: admin._id, date: daysAgo(32), createdAt: daysAgo(32) },
      { amount: 180000, currency: 'INR', source: 'Delta App contract #1', status: 'received', processedBy: admin._id, date: daysAgo(35), createdAt: daysAgo(35) },
      { amount: 60000,  currency: 'INR', source: 'GlobalBiz retainer', status: 'refunded', processedBy: admin._id, date: daysAgo(30), createdAt: daysAgo(30) },

      // May (Current month)
      { amount: 65000,  currency: 'INR', source: 'Acme SEO retainer', status: 'received', processedBy: admin._id, date: daysAgo(8), createdAt: daysAgo(8) },
      { amount: 110000, currency: 'INR', source: 'TechCorp SaaS milestone', status: 'received', processedBy: admin._id, date: daysAgo(5), createdAt: daysAgo(5) },
      { amount: 120000, currency: 'INR', source: 'SparkMedia Design retainer', status: 'received', processedBy: admin._id, date: daysAgo(1), createdAt: daysAgo(1) },
      { amount: 45000,  currency: 'INR', source: 'GlobalBiz retainer', status: 'pending', processedBy: admin._id, date: daysAgo(2), createdAt: daysAgo(2) },
    ];

    await Revenue.collection.insertMany(revenueDocs);
    console.log(`📈 Seeded ${revenueDocs.length} revenue transactions spanning last 4 calendar months`);

    // 7. Seed Meetings & Invitations (10 events)
    const meetingDocs = [
      {
        title:         'Weekly Team Standup',
        description:   'Sync on sprints and task statuses.',
        type:          'internal',
        date:          fmtDate(daysAgo(4)),
        time:          '09:00',
        duration:      '30 min',
        startTime:     new Date(`${fmtDate(daysAgo(4))}T09:00:00`),
        endTime:       new Date(`${fmtDate(daysAgo(4))}T09:30:00`),
        status:        'completed',
        participants:  [admin._id, manager._id, mike._id, emma._id, james._id],
        location:      'Google Meet',
        notes:         'Regular sync completed.',
        meetingLink:   'https://meet.google.com/abc-defg-hij',
        createdBy:     admin._id,
        createdAt:     daysAgo(5),
      },
      {
        title:         'Client Kickoff: Delta Ventures',
        description:   'Kickoff call with the Delta Mobile App team.',
        type:          'client',
        date:          fmtDate(daysAgo(15)),
        time:          '14:00',
        duration:      '60 min',
        startTime:     new Date(`${fmtDate(daysAgo(15))}T14:00:00`),
        endTime:       new Date(`${fmtDate(daysAgo(15))}T15:00:00`),
        status:        'completed',
        participants:  [admin._id, mike._id, emma._id],
        clientId:      delta._id,
        location:      'Zoom Platform',
        notes:         'Discussed Stripe configurations.',
        meetingLink:   'https://zoom.us/j/123456789',
        createdBy:     admin._id,
        createdAt:     daysAgo(18),
      },
      {
        title:         'Creative Branding Sync',
        description:   'Redesign brain brainstorming call.',
        type:          'internal',
        date:          fmtDate(daysFromNow(1)),
        time:          '11:00',
        duration:      '45 min',
        startTime:     new Date(`${fmtDate(daysFromNow(1))}T11:00:00`),
        endTime:       new Date(`${fmtDate(daysFromNow(1))}T11:45:00`),
        status:        'upcoming',
        participants:  [manager._id, emma._id],
        location:      'Figma Canvas Huddle',
        notes:         'Review Tony Stark feedback.',
        meetingLink:   'https://meet.google.com/fig-brand-sync',
        createdBy:     manager._id,
        createdAt:     daysAgo(2),
      },
      {
        title:         '🚨 Emergency Production Standup',
        description:   'Critical server gateway breakdown standup call.',
        type:          'internal',
        date:          fmtDate(daysFromNow(3)),
        time:          '16:30',
        duration:      '30 min',
        startTime:     new Date(`${fmtDate(daysFromNow(3))}T16:30:00`),
        endTime:       new Date(`${fmtDate(daysFromNow(3))}T17:00:00`),
        status:        'upcoming',
        participants:  [admin._id, manager._id, mike._id, emma._id, james._id],
        location:      'Zoom Emergency Line',
        notes:         'Forced join call.',
        meetingLink:   'https://zoom.us/j/911-911-911',
        createdBy:     admin._id,
        emergencyFlag: true,
        createdAt:     daysAgo(1),
      },
    ];

    const meetingsResult = await Meeting.collection.insertMany(meetingDocs);
    const meetingsList = await Meeting.find();
    console.log(`📅 Seeded ${meetingsList.length} meetings across active calendars`);

    const standardStandup = meetingsList.find(m => m.title === 'Weekly Team Standup');
    const creativeSync = meetingsList.find(m => m.title === 'Creative Branding Sync');
    const emergencyCall = meetingsList.find(m => m.title === '🚨 Emergency Production Standup');

    // Create corresponding meeting invitations
    const invitationDocs = [
      // Standard Standup (All accepted retrospectively)
      { meetingId: standardStandup._id, userId: mike._id, status: 'accepted', createdAt: daysAgo(5) },
      { meetingId: standardStandup._id, userId: emma._id, status: 'accepted', createdAt: daysAgo(5) },
      { meetingId: standardStandup._id, userId: james._id, status: 'accepted', createdAt: daysAgo(5) },

      // Creative Sync (Emma pending, James accepted)
      { meetingId: creativeSync._id, userId: emma._id, status: 'pending', createdAt: daysAgo(2) },
      { meetingId: creativeSync._id, userId: james._id, status: 'accepted', createdAt: daysAgo(2) },

      // Emergency Call (Bypassed forced accepts automatically)
      { meetingId: emergencyCall._id, userId: mike._id, status: 'accepted', createdAt: daysAgo(1) },
      { meetingId: emergencyCall._id, userId: emma._id, status: 'accepted', createdAt: daysAgo(1) },
      { meetingId: emergencyCall._id, userId: james._id, status: 'accepted', createdAt: daysAgo(1) },
    ];

    await MeetingInvitation.collection.insertMany(invitationDocs);
    console.log(`📩 Seeded ${invitationDocs.length} matching interactive meeting invitations`);

    // 8. Seed WorkLogs (Daily logs for standard members over the last 10 working days)
    const worklogDocs = [];
    const membersPool = [mike, emma, james];

    for (let day = 1; day <= 10; day++) {
      const dateStr = fmtDate(daysAgo(day));
      
      membersPool.forEach((member) => {
        const hoursWorked = 7.5 + Math.random() * 2; // 7.5 to 9.5 hours
        const secondsWorked = Math.floor(hoursWorked * 3600);
        
        worklogDocs.push({
          userId:       member._id,
          date:         dateStr,
          workSeconds:  secondsWorked,
          sessionStart: '09:00 AM',
          active:       false,
          breaks: [
            { type: 'lunch', reason: 'Team lunch', planned: 3600, actual: 3720, endedAt: '01:00 PM' }
          ],
          createdAt:    daysAgo(day)
        });
      });
    }

    await WorkLog.collection.insertMany(worklogDocs);
    console.log(`⏳ Seeded ${worklogDocs.length} daily employee worklogs over the last 10 days`);

    // 9. Seed Chat Messages
    const messageDocs = [
      { threadId: 'general', userId: admin._id, text: 'Welcome back to the AgencyOS main communication channel!', createdAt: daysAgo(10) },
      { threadId: 'general', userId: manager._id, text: 'Great! Let’s complete this sprint aggressively.', createdAt: daysAgo(9) },
      { threadId: 'general', userId: mike._id, text: 'API routes are set. Gateway integrations are in progress!', createdAt: daysAgo(5) },
      { threadId: 'general', userId: emma._id, text: 'Beautiful! UI overlays are already loaded.', createdAt: daysAgo(4) },
    ];

    await Message.collection.insertMany(messageDocs);
    console.log(`💬 Seeded channel communication logs`);

    console.log('\n✨ Database seeding completed successfully!');
    console.log('Seeded Users:');
    users.forEach((u) => {
      console.log(`   - [${u.role.toUpperCase()}] ${u.name} (${u.email})`);
    });
    console.log('\nUse these details to log in and inspect dynamic heatmap glowing grids and dynamic growth charts!\n');

  } catch (err) {
    console.error('❌ Seed failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
