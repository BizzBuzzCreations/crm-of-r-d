require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const { Revenue, Meeting, MeetingInvitation } = require('./src/models');
const revenueController = require('./src/controllers/revenueController');
const meetingSchedulerController = require('./src/controllers/meetingSchedulerController');

async function runTests() {
  console.log('🚀 Starting Integration & Unit Test Suite...');
  
  // Connect to DB
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bizzbuzzcrm');
  console.log('🔌 Connected to test database.');

  // Find or create test users
  let admin = await User.findOne({ role: 'admin' });
  let member1 = await User.findOne({ role: 'member' });
  let member2 = await User.findOne({ role: 'member', email: { $ne: member1?.email } });

  if (!admin) {
    admin = await User.create({ name: 'Test Admin', email: 't-admin@agency.com', password: 'password123', role: 'admin' });
  }
  if (!member1) {
    member1 = await User.create({ name: 'Test Member 1', email: 't-member1@agency.com', password: 'password123', role: 'member' });
  }
  if (!member2) {
    member2 = await User.create({ name: 'Test Member 2', email: 't-member2@agency.com', password: 'password123', role: 'member' });
  }

  console.log(`👥 Test Users initialized: Admin(${admin.email}), Members(${member1.email}, ${member2.email})`);

  // Clear previous test records
  await Revenue.deleteMany({ source: /Test Source/ });
  await Meeting.deleteMany({ title: /Test Meeting/ });
  await MeetingInvitation.deleteMany({});

  console.log('🧹 Cleaned up old test records.');

  // ==========================================
  // TEST 1: Record Revenue & Aggregation
  // ==========================================
  console.log('\n--- 📊 TEST 1: Revenue System & Pipeline Aggregation ---');
  
  // Add some test revenue records
  await Revenue.create([
    { amount: 5000, source: 'Test Source A', status: 'received', processedBy: admin._id },
    { amount: 2000, source: 'Test Source A', status: 'pending', processedBy: admin._id },
    { amount: 10000, source: 'Test Source B', status: 'received', processedBy: admin._id },
    { amount: 3000, source: 'Test Source B', status: 'refunded', processedBy: admin._id }
  ]);
  console.log('✅ Generated dummy revenue records.');

  // Run controller aggregation summary via mock request
  const mockReqSummary = {};
  const mockResSummary = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };

  await revenueController.getRevenueSummary(mockReqSummary, mockResSummary, (err) => {
    if (err) throw err;
  });

  console.log('Aggregated summary response:', JSON.stringify(mockResSummary.body, null, 2));
  const data = mockResSummary.body.data;
  if (data.totalRevenue !== 15000) {
    throw new Error(`Expected total received revenue of 15000, got ${data.totalRevenue}`);
  }
  if (data.pendingBalance !== 2000) {
    throw new Error(`Expected pending balance of 2000, got ${data.pendingBalance}`);
  }
  console.log('✅ Aggregate totalRevenue and pendingBalance calculations are correct!');

  // ==========================================
  // TEST 2: Invitation Scheduler & Emergency RSVP
  // ==========================================
  console.log('\n--- 📅 TEST 2: Invitation Meeting Scheduler & RSVPs ---');

  // A. Regular Meeting (emergencyFlag = false)
  const mockReqMeeting1 = {
    body: {
      title: 'Test Meeting Regular',
      description: 'Discuss marketing roadmap',
      startTime: new Date(Date.now() + 3600000),
      endTime: new Date(Date.now() + 7200000),
      emergencyFlag: false,
      invitedUserIds: [member1._id, member2._id]
    },
    user: admin
  };

  const mockResMeeting1 = {
    status(code) { return this; },
    json(data) {
      this.body = data;
      return this;
    }
  };

  await meetingSchedulerController.scheduleMeeting(mockReqMeeting1, mockResMeeting1, (err) => { if (err) throw err; });
  console.log('Regular meeting response:', mockResMeeting1.body.message);
  
  // Verify invitations status: must be pending
  const regularInvitations = await MeetingInvitation.find({ meetingId: mockResMeeting1.body.data.meeting._id });
  regularInvitations.forEach((inv) => {
    if (inv.status !== 'pending') {
      throw new Error(`Expected invitation to be 'pending', but got ${inv.status}`);
    }
  });
  console.log('✅ Regular meetings successfully created pending invitations.');

  // B. Emergency Meeting (emergencyFlag = true)
  const mockReqMeeting2 = {
    body: {
      title: 'Test Meeting Emergency',
      description: 'Immediate corporate align',
      startTime: new Date(Date.now() + 3600000),
      endTime: new Date(Date.now() + 7200000),
      emergencyFlag: true,
      invitedUserIds: [member1._id, member2._id]
    },
    user: admin
  };

  const mockResMeeting2 = {
    status(code) { return this; },
    json(data) {
      this.body = data;
      return this;
    }
  };

  await meetingSchedulerController.scheduleMeeting(mockReqMeeting2, mockResMeeting2, (err) => { if (err) throw err; });
  console.log('Emergency meeting response:', mockResMeeting2.body.message);

  // Verify invitations status: must be instantly accepted
  const emergencyInvitations = await MeetingInvitation.find({ meetingId: mockResMeeting2.body.data.meeting._id });
  emergencyInvitations.forEach((inv) => {
    if (inv.status !== 'accepted') {
      throw new Error(`Expected emergency invitation to be instantly 'accepted', but got ${inv.status}`);
    }
  });
  console.log('✅ Emergency meeting successfully forced accepted RSVPs!');

  // ==========================================
  // TEST 3: Compound Key Index Constraint
  // ==========================================
  console.log('\n--- 🔒 TEST 3: Compound Unique Key Index Restriction ---');
  try {
    await MeetingInvitation.create({
      meetingId: mockResMeeting1.body.data.meeting._id,
      userId: member1._id,
      status: 'pending'
    });
    // This should fail because it was already created in Step 2A
    throw new Error('Duplicate key validation bypassed! Index failed.');
  } catch (err) {
    if (err.code === 11000) {
      console.log('✅ Compound key unique constraint correctly blocked duplicate invitation!');
    } else {
      throw err;
    }
  }

  // Clean up test records
  await Revenue.deleteMany({ source: /Test Source/ });
  await Meeting.deleteMany({ title: /Test Meeting/ });
  await MeetingInvitation.deleteMany({});
  
  console.log('\n🎉 ALL INTEGRATION TESTS PASSED TRIUMPHANTLY! 🎉');
  mongoose.disconnect();
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  mongoose.disconnect();
  process.exit(1);
});
