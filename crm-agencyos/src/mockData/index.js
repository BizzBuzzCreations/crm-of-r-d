// ─── Mock Users ────────────────────────────────────────────────
export const MOCK_USERS = [
  { id:1, name:'Alex Johnson',  email:'admin@agency.com',   password:'admin123',   role:'admin',   position:'CEO & Founder',      department:'Management', initials:'AJ', color:'#7C3AED', status:'online',  joinDate:'Jan 15, 2021', phone:'+1 (234) 567-8901', bio:'Leading the agency.', avatar:null },
  { id:2, name:'Sarah Chen',    email:'manager@agency.com', password:'manager123', role:'manager', position:'Project Manager',     department:'Operations', initials:'SC', color:'#0EA5E9', status:'online',  joinDate:'Mar 20, 2021', phone:'+1 (234) 567-8902', bio:'Managing projects.', avatar:null },
  { id:3, name:'Mike Davis',    email:'member@agency.com',  password:'member123',  role:'member',  position:'Senior Developer',    department:'Engineering',initials:'MD', color:'#10B981', status:'away',    joinDate:'Jun 10, 2021', phone:'+1 (234) 567-8903', bio:'Full-stack developer.', avatar:null },
  { id:4, name:'Emma Wilson',   email:'emma@agency.com',    password:'member123',  role:'member',  position:'UI/UX Designer',      department:'Design',     initials:'EW', color:'#F59E0B', status:'offline', joinDate:'Jan 5, 2022',  phone:'+1 (234) 567-8904', bio:'UI/UX designer.', avatar:null },
  { id:5, name:'James Brown',   email:'james@agency.com',   password:'member123',  role:'member',  position:'Content Strategist',  department:'Marketing',  initials:'JB', color:'#EF4444', status:'online',  joinDate:'Apr 15, 2022', phone:'+1 (234) 567-8905', bio:'Content strategist.', avatar:null },
];

// ─── Mock Clients (starts empty — add via UI) ──────────────────
export const MOCK_CLIENTS = [];

// ─── Mock Tasks ────────────────────────────────────────────────
export const MOCK_TASKS = [
  { id:1, title:'Design landing page', description:'Create responsive landing page following brand guidelines.', assignedTo:4, assignedBy:2, type:'client', clientId:null, dueDate:'2024-02-15', eta:'40h', priority:'high',   status:'in-progress',       createdAt:'2024-01-20', tags:['design','web'], progress:70 },
  { id:2, title:'SEO audit report',    description:'Full technical SEO audit and on-page optimization.',         assignedTo:5, assignedBy:2, type:'client', clientId:null, dueDate:'2024-02-10', eta:'20h', priority:'medium', status:'pending',            createdAt:'2024-01-18', tags:['seo'],          progress:0  },
  { id:3, title:'API integration',     description:'Integrate Google Analytics and Stripe APIs into dashboard.', assignedTo:3, assignedBy:2, type:'inhouse',clientId:null, dueDate:'2024-02-20', eta:'30h', priority:'urgent', status:'in-progress',        createdAt:'2024-01-22', tags:['dev','api'],    progress:55 },
  { id:4, title:'Brand identity',      description:'Complete brand identity: logo, colors, typography.',         assignedTo:4, assignedBy:2, type:'client', clientId:null, dueDate:'2024-02-28', eta:'60h', priority:'high',   status:'sent-for-approval',  createdAt:'2024-01-15', tags:['design'],       progress:95 },
  { id:5, title:'Performance report',  description:'Compile all client performance metrics for January.',        assignedTo:5, assignedBy:1, type:'inhouse',clientId:null, dueDate:'2024-02-05', eta:'8h',  priority:'medium', status:'completed',          createdAt:'2024-01-25', tags:['reporting'],    progress:100},
];

// ─── Mock Todos ────────────────────────────────────────────────
export const MOCK_TODOS = [
  { id:1, title:'Review client feedback',   description:'Go through all client feedback from last week.', userId:3, eta:'1h',   priority:'medium', status:'completed',           createdAt:'2024-01-31' },
  { id:2, title:'Update project docs',      description:'Update docs with latest API changes.',           userId:3, eta:'2h',   priority:'high',   status:'in-progress',         createdAt:'2024-01-31' },
  { id:3, title:'Prepare standup notes',    description:'Document blockers and upcoming tasks.',          userId:4, eta:'30m',  priority:'medium', status:'pending',             createdAt:'2024-01-31' },
  { id:4, title:'Code review PR #47',       description:'Review auth module before merging.',             userId:3, eta:'1.5h', priority:'urgent', status:'sent-for-approval',   createdAt:'2024-02-01' },
  { id:5, title:'Prepare design slides',    description:'Slides for StyleBrand design review.',           userId:4, eta:'2h',   priority:'high',   status:'pending',             createdAt:'2024-02-01' },
  { id:6, title:'Write Q1 blog post',       description:'Draft blog post about digital marketing trends.',userId:5, eta:'3h',   priority:'medium', status:'in-progress',         createdAt:'2024-02-01' },
];

// ─── Mock Meetings ─────────────────────────────────────────────
export const MOCK_MEETINGS = [
  { id:1, title:'Weekly Team Standup',     type:'internal', date:'2024-02-01', time:'09:00', duration:'30 min', status:'completed', participants:[1,2,3,4,5], clientId:null, location:'Google Meet',      notes:'Regular weekly sync.',     meetingLink:'https://meet.google.com' },
  { id:2, title:'Q1 Planning Session',     type:'client',   date:'2024-02-05', time:'10:00', duration:'60 min', status:'upcoming',  participants:[1,2,3],     clientId:null, location:'Zoom',             notes:'Discuss Q1 roadmap.',      meetingLink:'https://zoom.us' },
  { id:3, title:'Brand Identity Review',   type:'client',   date:'2024-02-07', time:'14:00', duration:'90 min', status:'upcoming',  participants:[2,4],        clientId:null, location:'In-Person',        notes:'Present brand concepts.',  meetingLink:null },
  { id:4, title:'New Lead Discovery Call', type:'lead',     date:'2024-02-09', time:'11:00', duration:'45 min', status:'upcoming',  participants:[1,2],        clientId:null, location:'Zoom',             notes:'Discovery call.',          meetingLink:'https://zoom.us' },
];

// ─── Mock Messages ─────────────────────────────────────────────
export const MOCK_MESSAGES = {
  channels: [
    { id:'general',      name:'general',        type:'channel', description:'Company-wide announcements', unread:2 },
    { id:'design',       name:'design',          type:'channel', description:'Design team discussions',    unread:0 },
    { id:'dev',          name:'development',     type:'channel', description:'Engineering updates',        unread:1 },
    { id:'marketing',    name:'marketing',       type:'channel', description:'Marketing and campaigns',    unread:0 },
    { id:'client-updates',name:'client-updates', type:'channel', description:'Client status updates',      unread:0 },
  ],
  dms: [
    { id:'dm-2', userId:2, unread:1 },
    { id:'dm-3', userId:3, unread:0 },
    { id:'dm-4', userId:4, unread:0 },
    { id:'dm-5', userId:5, unread:0 },
  ],
  threads: {
    'general': [
      { id:1, userId:1, text:'Good morning team! 🌅 We have 3 client deadlines this week. Let\'s make it count!', time:'9:02 AM', date:'Today' },
      { id:2, userId:2, text:'On it! Already scheduled check-ins for today.',                                      time:'9:15 AM', date:'Today' },
      { id:3, userId:3, text:'The landing page is 70% done. Ready for review by EOD.',                             time:'9:30 AM', date:'Today' },
      { id:4, userId:4, text:'Brand identity deck is looking amazing. Sending for approval this afternoon.',        time:'10:05 AM',date:'Today' },
      { id:5, userId:5, text:'Content calendar for Q1 is finalized — sharing in Drive now.',                       time:'10:18 AM',date:'Today' },
    ],
    'design': [
      { id:1, userId:4, text:'Just uploaded the latest Figma prototype. Check the mobile frame.',        time:'8:45 AM', date:'Today' },
      { id:2, userId:2, text:'Looks great Emma! Minor: CTA button on screen 3 needs more contrast.',    time:'9:00 AM', date:'Today' },
    ],
    'dev': [
      { id:1, userId:3, text:'PR #47 is up for review — Auth module with JWT. Tests all passing.',      time:'10:30 AM',date:'Today' },
      { id:2, userId:2, text:'On my list! Will review by 2pm.',                                         time:'10:45 AM',date:'Today' },
    ],
    'marketing': [
      { id:1, userId:5, text:'Q1 content calendar done! 84 posts across 5 clients. Link in Drive.',    time:'11:00 AM',date:'Today' },
    ],
    'client-updates': [],
    'dm-2': [
      { id:1, userId:2, text:'Hey! TechCorp moved the deadline to Feb 10. Can we manage?', time:'Yesterday 3:20 PM', date:'Yesterday' },
      { id:2, userId:3, text:'Tight but doable. I\'ll have a staging link ready tomorrow morning.',    time:'Yesterday 3:45 PM', date:'Yesterday' },
    ],
    'dm-3': [], 'dm-4': [], 'dm-5': [],
  },
};

// ─── Chart Data ────────────────────────────────────────────────
export const PRODUCTIVITY_DATA = [
  { month:'Aug', tasks:24, todos:32, meetings:8 },
  { month:'Sep', tasks:30, todos:28, meetings:10},
  { month:'Oct', tasks:28, todos:35, meetings:12},
  { month:'Nov', tasks:35, todos:40, meetings:9 },
  { month:'Dec', tasks:20, todos:18, meetings:6 },
  { month:'Jan', tasks:38, todos:45, meetings:14},
];
export const TASK_STATUS_DIST = [
  { name:'Completed',   value:42, color:'#10B981' },
  { name:'In Progress', value:18, color:'#6366f1' },
  { name:'Pending',     value:12, color:'#F59E0B' },
  { name:'For Approval',value:8,  color:'#8B5CF6' },
];
export const REVENUE_DATA = [
  { month:'Sep', revenue:18000 },{ month:'Oct', revenue:22000 },
  { month:'Nov', revenue:19500 },{ month:'Dec', revenue:24000 },
  { month:'Jan', revenue:28500 },{ month:'Feb', revenue:31000 },
];
export const TEAM_PERFORMANCE = [
  { name:'Mike Davis',  completed:18, inProgress:4, pending:2, rate:82, dept:'Engineering' },
  { name:'Emma Wilson', completed:15, inProgress:3, pending:1, rate:89, dept:'Design'      },
  { name:'James Brown', completed:12, inProgress:5, pending:3, rate:75, dept:'Marketing'   },
];
export const GANTT_PROJECTS = [];

export function generateHeatmapData() {
  const data=[], today=new Date();
  for(let i=83;i>=0;i--){
    const d=new Date(today); d.setDate(d.getDate()-i);
    const wk=d.getDay()===0||d.getDay()===6;
    data.push({ date:d.toISOString().split('T')[0], count:wk?Math.floor(Math.random()*2):Math.floor(Math.random()*9) });
  }
  return data;
}
export const MOCK_NOTIFICATIONS = [
  { id:1, type:'task',    title:'Brand identity sent for approval', body:'Emma Wilson submitted a task',    time:'5m ago',    unread:true  },
  { id:2, type:'meeting', title:'Meeting reminder',                 body:'Q1 Planning — Feb 5 at 10:00 AM',time:'1h ago',    unread:true  },
  { id:3, type:'client',  title:'Payment overdue',                  body:'Invoice #004 is 5 days overdue',  time:'3h ago',    unread:false },
];
