const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User     = require('./models/User');
const Lead     = require('./models/Lead');
const Service  = require('./models/Service');
const AuditLog = require('./models/AuditLog');
const EmailLog = require('./models/EmailLog');
const Notification = require('./models/Notification');
const SystemSettings = require('./models/SystemSettings');
const {
  Client, Task, Todo, Meeting, MeetingInvitation, Revenue, WorkLog, Message, Channel, Project, Counter
} = require('./models/index');

// ── Demo Data Lists ──────────────────────────────────────────

const USERS_DATA = [
  {
    name:       'bizzbuzzcreations',
    email:      'dev@bizzbuzzcreations.com',
    password:   'bbc655',
    role:       'admin',
    position:   'CEO & Founder',
    department: 'Management',
    color:      '#7C3AED',
    joinDate:   '2026-05-26',
    phone:      '+91 99999 99999',
    bio:        'Leading the agency vision and product strategy.',
    status:     'online',
  },
  {
    name:       'Sarah Connor',
    email:      'admin@agency.com',
    password:   'admin123',
    role:       'admin',
    position:   'Operations Director',
    department: 'Management',
    color:      '#EF4444',
    joinDate:   '2026-01-15',
    phone:      '+91 98765 43210',
    bio:        'Managing agency workflows, corporate compliance, and team resourcing.',
    status:     'online',
  },
  {
    name:       'John Miller',
    email:      'manager@agency.com',
    password:   'manager123',
    role:       'manager',
    position:   'Product Lead',
    department: 'Engineering',
    color:      '#F59E0B',
    joinDate:   '2026-02-10',
    phone:      '+91 88888 77777',
    bio:        'Overseeing technical milestones and client project deliverables.',
    status:     'online',
  },
  {
    name:       'Alex Carter',
    email:      'member@agency.com',
    password:   'member123',
    role:       'member',
    position:   'UX Specialist',
    department: 'Creative',
    color:      '#10B981',
    joinDate:   '2026-03-01',
    phone:      '+91 77777 66666',
    bio:        'Crafting interface structures, layouts, and interactive experiences.',
    status:     'away',
  },
  {
    name:       'David Chen',
    email:      'developer@agency.com',
    password:   'developer123',
    role:       'member',
    position:   'Senior Developer',
    department: 'Engineering',
    color:      '#3B82F6',
    joinDate:   '2026-03-15',
    phone:      '+91 66666 55555',
    bio:        'Architecting robust Node APIs, database indexes, and React state systems.',
    status:     'online',
  },
  {
    name:       'Emma Watson',
    email:      'designer@agency.com',
    password:   'designer123',
    role:       'member',
    position:   'Brand Illustrator',
    department: 'Creative',
    color:      '#EC4899',
    joinDate:   '2026-04-01',
    phone:      '+91 55555 44444',
    bio:        'Designing identity guidelines, vectors, and digital brand collateral.',
    status:     'offline',
  }
];

const SERVICES_DATA = [
  { name: 'Custom Web Applications', description: 'Interactive React and Node enterprise dashboard development.', category: 'Engineering', color: '#6366f1', icon: '⚡' },
  { name: 'Search Engine Optimization', description: 'Advanced search indexing, schema injection, and keyword rankings.', category: 'Marketing', color: '#10b981', icon: '🌐' },
  { name: 'Brand Strategy & Identity', description: 'Custom vectors, color swatches, logos, and identity manuals.', category: 'Creative', color: '#ec4899', icon: '🎨' },
  { name: 'Social Media Management', description: 'Outreach campaigns, graphics scheduling, and audience metrics.', category: 'Marketing', color: '#f59e0b', icon: '📊' }
];

const CLIENTS_DATA = [
  { name: 'Acme Corporate Solutions', contact: 'Robert Downey', email: 'robert@acme.com', phone: '+1 555 101 2020', website: 'https://acme.com', industry: 'Technology', budget: '12,50,000', contractDuration: '12 months', status: 'active', paymentStatus: 'paid', onboardingDate: '2026-01-20' },
  { name: 'Delta Cybernetics', contact: 'Marcus Wright', email: 'marcus@deltacyber.io', phone: '+1 555 303 4040', website: 'https://deltacyber.io', industry: 'Healthcare', budget: '8,00,000', contractDuration: '6 months', status: 'active', paymentStatus: 'pending', onboardingDate: '2026-03-10' },
  { name: 'Initech Systems', contact: 'Peter Gibbons', email: 'peter@initech.com', phone: '+1 555 505 6060', website: 'https://initech.com', industry: 'Retail', budget: '4,50,000', contractDuration: '3 months', status: 'on-hold', paymentStatus: 'overdue', onboardingDate: '2026-04-05' },
  { name: 'Globex Agency Network', contact: 'Hank Scorpio', email: 'hank@globex.org', phone: '+1 555 707 8080', website: 'https://globex.org', industry: 'Marketing', budget: '22,00,000', contractDuration: '24 months', status: 'active', paymentStatus: 'paid', onboardingDate: '2026-02-15' }
];

async function seedDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // 1. Wipe collections
    console.log('🗑️  Clearing all collections...');
    await Promise.all([
      User.deleteMany({}),
      Client.deleteMany({}),
      Project.deleteMany({}),
      Task.deleteMany({}),
      Todo.deleteMany({}),
      Meeting.deleteMany({}),
      MeetingInvitation.deleteMany({}),
      Revenue.deleteMany({}),
      WorkLog.deleteMany({}),
      Message.deleteMany({}),
      Channel.deleteMany({}),
      Lead.deleteMany({}),
      Service.deleteMany({}),
      Notification.deleteMany({}),
      AuditLog.deleteMany({}),
      EmailLog.deleteMany({}),
      SystemSettings.deleteMany({}),
      Counter.deleteMany({})
    ]);
    console.log('✅ Collections cleared.\n');

    // 2. System Settings
    console.log('⚙️  Creating default System Settings...');
    const settings = await SystemSettings.create({});
    console.log('✅ System Settings initialized.\n');

    // 3. Create Users
    console.log('👥 Seeding Users...');
    const users = [];
    for (const userData of USERS_DATA) {
      const u = await User.create(userData);
      users.push(u);
      console.log(`   └─ Created User: ${u.name} (${u.email}) [${u.role}]`);
    }
    console.log('✅ Users seeded successfully.\n');

    // Map roles for easy reference
    const adminUser = users.find(u => u.email === 'dev@bizzbuzzcreations.com');
    const SarachAdmin = users.find(u => u.email === 'admin@agency.com');
    const JohnManager = users.find(u => u.email === 'manager@agency.com');
    const AlexMember = users.find(u => u.email === 'member@agency.com');
    const DavidDev = users.find(u => u.email === 'developer@agency.com');
    const EmmaDesigner = users.find(u => u.email === 'designer@agency.com');

    // 4. Create Services
    console.log('💼 Seeding Services...');
    const services = [];
    for (const svcData of SERVICES_DATA) {
      const s = await Service.create({ ...svcData, createdBy: JohnManager._id });
      services.push(s);
    }
    console.log(`✅ ${services.length} Services created.\n`);

    // 5. Create Clients
    console.log('🏢 Seeding Clients...');
    const clients = [];
    for (let i = 0; i < CLIENTS_DATA.length; i++) {
      const clientPayload = {
        ...CLIENTS_DATA[i],
        assignedTeam: [JohnManager._id, DavidDev._id, AlexMember._id, EmmaDesigner._id],
        createdBy: SarachAdmin._id,
        notes: [
          { text: 'Onboarding session finished successfully.', author: 'Sarah Connor', date: 'May 28, 2026' },
          { text: 'Requested custom billing schedule.', author: 'John Miller', date: 'June 01, 2026' }
        ]
      };
      const c = await Client.create(clientPayload);
      clients.push(c);
      console.log(`   └─ Created Client: ${c.name}`);
    }
    console.log('✅ Clients seeded.\n');

    // 6. Create Projects
    console.log('🚀 Seeding Projects...');
    const projects = [];
    const projSpecs = [
      { name: 'Acme Portal Development', description: 'Next.js application integrated with legacy CRM system.', client: clients[0], budget: '8,00,000', duration: { start: '2026-02-01', end: '2026-08-31' } },
      { name: 'Delta Threat Analysis UX', description: 'Healthcare security dashboard structure redesign.', client: clients[1], budget: '5,00,000', duration: { start: '2026-03-15', end: '2026-09-15' } },
      { name: 'Globex Integrated Campaign', description: 'SEO content optimization and brand identity deployment.', client: clients[3], budget: '15,00,000', duration: { start: '2026-02-20', end: '2026-12-31' } }
    ];

    for (const spec of projSpecs) {
      const p = await Project.create({
        name: spec.name,
        description: spec.description,
        clientId: spec.client._id,
        assignedTeam: [JohnManager._id, DavidDev._id, EmmaDesigner._id],
        status: 'in-progress',
        startDate: spec.duration.start,
        endDate: spec.duration.end,
        budget: spec.budget,
        createdBy: JohnManager._id
      });
      projects.push(p);
      
      // Update client project count
      await Client.findByIdAndUpdate(spec.client._id, { $inc: { projectCount: 1 } });
      console.log(`   └─ Created Project: ${p.name} for ${spec.client.name}`);
    }
    console.log('✅ Projects seeded.\n');

    // 7. Create Tasks
    console.log('📋 Seeding Tasks...');
    const tasks = [];
    const taskSpecs = [
      { title: 'Redesign Login Page', desc: 'Mock design proposals using Figma.', project: projects[0], client: clients[0], assignee: EmmaDesigner, priority: 'high', status: 'completed', progress: 100, type: 'client' },
      { title: 'Create DB Schemas & APIs', desc: 'Write Mongoose model mappings and login JWT endpoints.', project: projects[0], client: clients[0], assignee: DavidDev, priority: 'urgent', status: 'completed', progress: 100, type: 'client' },
      { title: 'UX Flow Testing', desc: 'Moderate wireframe test reviews with pilot user cohorts.', project: projects[1], client: clients[1], assignee: AlexMember, priority: 'medium', status: 'in-progress', progress: 45, type: 'client' },
      { title: 'Deploy SEO Audit Strategy', desc: 'Review crawl maps, site schemas, and tag distributions.', project: projects[2], client: clients[3], assignee: DavidDev, priority: 'medium', status: 'sent-for-approval', progress: 90, type: 'client' },
      { title: 'Internal Operations Sync', desc: 'Prepare onboarding reports and logs for managers review.', project: null, client: null, assignee: AlexMember, priority: 'low', status: 'pending', progress: 0, type: 'inhouse' },
      { title: 'Brand Guide Manual Creation', desc: 'Compile SVG assets, palette sheets, and font rules.', project: projects[2], client: clients[3], assignee: EmmaDesigner, priority: 'high', status: 'in-progress', progress: 65, type: 'client' }
    ];

    for (const spec of taskSpecs) {
      const t = await Task.create({
        title: spec.title,
        description: spec.desc,
        assignedTo: spec.assignee._id,
        assignedBy: JohnManager._id,
        clientId: spec.client ? spec.client._id : null,
        projectId: spec.project ? spec.project._id : null,
        type: spec.type,
        startDate: '2026-06-01',
        dueDate: '2026-06-30',
        priority: spec.priority,
        status: spec.status,
        progress: spec.progress,
        attachments: spec.status === 'sent-for-approval' ? [
          { type: 'link', name: 'SEO Report Doc', url: 'https://docs.google.com/document/d/example' }
        ] : []
      });
      tasks.push(t);
    }
    console.log(`✅ ${tasks.length} Tasks created.\n`);

    // 8. Create Todos
    console.log('✍️  Seeding Daily Todos...');
    const todos = [
      { title: 'Review Figma wireframes feedback', userId: EmmaDesigner._id, priority: 'medium', status: 'completed' },
      { title: 'Fix API socket reconnection crash', userId: DavidDev._id, priority: 'urgent', status: 'in-progress' },
      { title: 'Draft weekly tasks log digest', userId: JohnManager._id, priority: 'low', status: 'pending' },
      { title: 'Verify SSL registration settings', userId: DavidDev._id, priority: 'high', status: 'completed' }
    ];
    for (const todo of todos) {
      await Todo.create({
        ...todo,
        assignedBy: JohnManager._id,
        startDate: '2026-06-08',
        dueDate: '2026-06-09'
      });
    }
    console.log('✅ Daily Todos seeded.\n');

    // 9. Create Meetings & invitations
    console.log('📅 Seeding Meetings...');
    const meetings = [
      {
        title: 'Project Kickoff — Delta Cybernetics',
        description: 'Syncing project timeline, resources, and UX deliverables.',
        type: 'client',
        date: '2026-06-12',
        time: '11:00 AM',
        duration: '60 min',
        startTime: new Date('2026-06-12T11:00:00'),
        endTime: new Date('2026-06-12T12:00:00'),
        status: 'upcoming',
        participants: [JohnManager._id, AlexMember._id, EmmaDesigner._id],
        clientId: clients[1]._id,
        location: 'Conference Room Alpha / Google Meet',
        meetingLink: 'https://meet.google.com/abc-defg-hij',
        createdBy: JohnManager._id
      },
      {
        title: 'Weekly Engineering Sprint Sync',
        description: 'API code reviews, DB index optimization review, and server logs inspection.',
        type: 'internal',
        date: '2026-06-08',
        time: '10:00 AM',
        duration: '45 min',
        startTime: new Date('2026-06-08T10:00:00'),
        endTime: new Date('2026-06-08T10:45:00'),
        status: 'completed',
        participants: [JohnManager._id, DavidDev._id],
        clientId: null,
        location: 'Virtual',
        meetingLink: 'https://meet.google.com/xyz-uvwx-yza',
        createdBy: JohnManager._id
      }
    ];

    for (const mtg of meetings) {
      const m = await Meeting.create(mtg);
      for (const pId of mtg.participants) {
        await MeetingInvitation.create({
          meetingId: m._id,
          userId: pId,
          status: pId.toString() === DavidDev._id.toString() || pId.toString() === JohnManager._id.toString() ? 'accepted' : 'pending'
        });
      }
      console.log(`   └─ Scheduled Meeting: ${m.title}`);
    }
    console.log('✅ Meetings seeded.\n');

    // 10. Create Revenue
    console.log('💰 Seeding Revenue Ledger...');
    const revenues = [
      { amount: 150000, currency: 'INR', source: 'Acme Corp Portal Milestone 1', status: 'received', processedBy: adminUser._id, date: new Date('2026-05-10') },
      { amount: 80000, currency: 'INR', source: 'Delta UX retainer initial deposit', status: 'received', processedBy: adminUser._id, date: new Date('2026-05-25') },
      { amount: 200000, currency: 'INR', source: 'Globex Campaign Setup invoice', status: 'received', processedBy: adminUser._id, date: new Date('2026-06-02') },
      { amount: 120000, currency: 'INR', source: 'Initech Systems overdue billing', status: 'pending', processedBy: adminUser._id, date: new Date('2026-06-05') }
    ];
    await Revenue.insertMany(revenues);
    console.log('✅ Revenue records seeded.\n');

    // 11. Create Channels & Messages
    console.log('💬 Seeding Chat Channels & Messages...');
    const channels = [
      { name: 'general', description: 'Company-wide updates and chat.', isPrivate: false, members: users.map(u => u._id), createdBy: adminUser._id },
      { name: 'engineering', description: 'API setups, Node workers, and code logs.', isPrivate: true, members: [adminUser._id, JohnManager._id, DavidDev._id], createdBy: JohnManager._id },
      { name: 'creative', description: 'Design assets, Figma boards, and illustration sync.', isPrivate: false, members: [JohnManager._id, AlexMember._id, EmmaDesigner._id], createdBy: EmmaDesigner._id }
    ];

    for (const chan of channels) {
      const c = await Channel.create(chan);
      console.log(`   └─ Created Chat Channel: #${c.name}`);

      // Add a couple of initial messages
      if (c.name === 'general') {
        const m1 = await Message.create({
          threadId: c._id.toString(),
          userId: JohnManager._id,
          text: 'Welcome to the BizzBuzz digital workspace! Real-time alerts are now active.'
        });
        await Message.create({
          threadId: c._id.toString(),
          userId: AlexMember._id,
          text: 'Thanks John! Love the clean system design interface.',
          reactions: [{ userId: JohnManager._id, emoji: '👍' }]
        });
      } else if (c.name === 'engineering') {
        await Message.create({
          threadId: c._id.toString(),
          userId: DavidDev._id,
          text: 'Outbound email queue is fully active on BullMQ. Let me know if any logs trigger failures.'
        });
      }
    }

    // Seed a direct message (DM) thread between DavidDev and EmmaDesigner
    const sortedDMPair = [DavidDev._id.toString(), EmmaDesigner._id.toString()].sort();
    const dmThreadId = `dm-${sortedDMPair[0]}-${sortedDMPair[1]}`;
    await Message.create({
      threadId: dmThreadId,
      userId: EmmaDesigner._id,
      text: 'Hi David, did you integrate the assets I sent for the onboarding forms?'
    });
    await Message.create({
      threadId: dmThreadId,
      userId: DavidDev._id,
      text: 'Yes! They look great. File uploads are fully working now.'
    });
    console.log('✅ Chat Channels and Messages seeded.\n');

    // 12. Create WorkLogs
    console.log('⏱️  Seeding Work Logs...');
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const logs = [
      { userId: DavidDev._id, date: yesterdayStr, workSeconds: 8 * 3600, sessionStart: '09:00', active: false, targetSeconds: 8 * 3600, breaks: [{ type: 'lunch', reason: 'Lunch Break', actual: 45, endedAt: '13:45' }] },
      { userId: EmmaDesigner._id, date: yesterdayStr, workSeconds: 7.5 * 3600, sessionStart: '09:30', active: false, targetSeconds: 8 * 3600, breaks: [] },
      { userId: DavidDev._id, date: todayStr, workSeconds: 4 * 3600, sessionStart: '09:00', active: true, targetSeconds: 8 * 3600, breaks: [] }
    ];
    await WorkLog.insertMany(logs);
    console.log('✅ Work Logs seeded.\n');

    // 13. Create Leads
    console.log('🎯 Seeding Sales Leads...');
    const leads = [
      {
        companyName: 'Umbrella Corporation',
        contactPerson: 'Albert Wesker',
        email: 'albert@umbrella.com',
        phone: '+1 555 909 0000',
        website: 'https://umbrella.com',
        dealValue: 1850000,
        status: 'Proposal Sent',
        source: 'Manual',
        assignedTo: JohnManager._id,
        watchers: [adminUser._id],
        tags: ['enterprise', 'biotech'],
        contacts: [
          { name: 'Ada Wong', role: 'Strategic Advisor', email: 'ada@umbrella.com', phone: '+1 555 909 0001' }
        ],
        notes: [
          { text: 'Proposal deck dispatched. Initial review looks promising.', author: JohnManager._id, authorName: 'John Miller' }
        ],
        activities: [
          { type: 'create', text: 'Lead created in pipeline.', performedBy: 'Sarah Connor' },
          { type: 'status_change', text: 'Stage shifted: New Lead ➔ Proposal Sent', performedBy: 'John Miller' }
        ]
      },
      {
        companyName: 'Cyberdyne Systems',
        contactPerson: 'Miles Dyson',
        email: 'miles@cyberdyne.co',
        phone: '+1 555 808 1111',
        website: 'https://cyberdyne.co',
        dealValue: 950000,
        status: 'New Lead',
        source: 'Web Form',
        assignedTo: JohnManager._id,
        tags: ['ai', 'defense'],
        contacts: [],
        notes: [],
        activities: [
          { type: 'create', text: 'Lead captured automatically from agency contact form.', performedBy: 'System' }
        ]
      }
    ];

    for (const lead of leads) {
      await Lead.create(lead);
    }
    console.log('✅ Sales Leads seeded.\n');

    // 14. Create Notifications
    console.log('🔔 Seeding System Notifications...');
    const notifications = [
      { recipient: DavidDev._id, sender: JohnManager._id, type: 'task_assigned', priority: 'info', title: 'New Task Assigned', message: 'You have been assigned: Create DB Schemas & APIs', link: '/tasks', read: false },
      { recipient: EmmaDesigner._id, sender: JohnManager._id, type: 'task_assigned', priority: 'info', title: 'New Task Assigned', message: 'You have been assigned: Redesign Login Page', link: '/tasks', read: true },
      { recipient: JohnManager._id, sender: AlexMember._id, type: 'task_ready_approval', priority: 'warning', title: 'Task Ready For Approval', message: 'Alex submitted: Deploy SEO Audit Strategy for review', link: '/tasks', read: false }
    ];
    await Notification.insertMany(notifications);
    console.log('✅ System Notifications seeded.\n');

    // 15. Create EmailLogs
    console.log('✉️  Seeding Outbound Email Logs...');
    const emailLogs = [
      { recipientEmail: 'robert@acme.com', emailType: 'WELCOME_EMAIL', subject: 'Welcome to BizzBuzz CRM', bodyText: 'Hi Robert, welcome to BizzBuzz!', status: 'sent', messageId: 'msg-acme-123', triggeredBy: adminUser._id },
      { recipientEmail: 'albert@umbrella.com', emailType: 'OUTBOUND_EMAIL', subject: 'Agency Proposal and Scope of Work', bodyText: 'Hi Albert, please find the proposal deck...', status: 'sent', messageId: 'msg-umbrella-456', triggeredBy: JohnManager._id }
    ];
    await EmailLog.insertMany(emailLogs);
    console.log('✅ Email logs seeded.\n');

    // 16. Create AuditLogs
    console.log('🛡️  Seeding Audit Logs...');
    const auditLogs = [
      { actor: { id: adminUser._id, name: adminUser.name, role: adminUser.role }, action: 'login', category: 'auth', metadata: { source: 'desktop' }, ip: '127.0.0.1', userAgent: 'Mozilla/5.0' },
      { actor: { id: JohnManager._id, name: JohnManager.name, role: JohnManager.role }, action: 'create', category: 'task', target: { model: 'Task', title: 'Redesign Login Page' }, ip: '127.0.0.1', userAgent: 'Mozilla/5.0' },
      { actor: { id: JohnManager._id, name: JohnManager.name, role: JohnManager.role }, action: 'assign', category: 'lead', target: { model: 'Lead', title: 'Umbrella Corporation' }, ip: '127.0.0.1', userAgent: 'Mozilla/5.0' }
    ];
    await AuditLog.insertMany(auditLogs);
    console.log('✅ Audit Logs seeded.\n');

    console.log('══════════════════════════════════════════════════');
    console.log('🎉 Database fully seeded with rich, complete mock logs!');
    console.log('══════════════════════════════════════════════════');
    console.log('Active accounts summary:');
    USERS_DATA.forEach((u) => {
      console.log(`  Name:     ${u.name.padEnd(20)} [${u.role.toUpperCase()}]`);
      console.log(`  Email:    ${u.email}`);
      console.log(`  Password: ${u.password}`);
      console.log('  ──────────────────────');
    });

  } catch (err) {
    console.error('❌ Seeding failed:', err.stack || err.message);
  } finally {
    console.log('🔌 Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('✅ Disconnected.');
    process.exit(0);
  }
}

seedDatabase();
