import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { CheckSquare, BarChart3, Users, Zap } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { MOCK_USERS } from '../../mockData';
import { Input, Button } from '../../components/ui';
import { cn, ROLE_CONFIG } from '../../utils/helpers';

const DEMO = [
  { user: MOCK_USERS[0], desc: 'Full system access',        gradient: 'from-violet-600 to-purple-700' },
  { user: MOCK_USERS[1], desc: 'Team & project access',     gradient: 'from-sky-500 to-blue-600'      },
  { user: MOCK_USERS[2], desc: 'Member access + timer',     gradient: 'from-emerald-500 to-teal-600'  },
];

const FEATURES = [
  { icon: CheckSquare, text: 'Task & Project Management'    },
  { icon: Users,       text: 'Client CRM & Relationships'   },
  { icon: BarChart3,   text: 'Analytics & Reports'          },
  { icon: Zap,         text: 'Real-time Team Collaboration' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const login    = useAppStore((s) => s.login);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const doLogin = (user) => {
    setLoading(true);
    setTimeout(() => {
      login(user);
      setLoading(false);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate('/dashboard');
    }, 400);
  };

  const onSubmit = ({ email, password }) => {
    const allUsers = JSON.parse(localStorage.getItem('crm_users') || 'null') || MOCK_USERS;
    const user = allUsers.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) { toast.error('Invalid email or password'); return; }
    doLogin(user);
  };

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-center items-center flex-1 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden px-12">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-3xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute w-[300px] h-[300px] rounded-full bg-purple-600/15 blur-3xl top-0 right-0" />
        </div>
        <motion.div className="relative z-10 max-w-lg w-full" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="backdrop-blur-md bg-white/[0.06] border border-white/10 rounded-2xl p-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-lg">AO</div>
              <div>
                <div className="text-white font-bold text-xl">AgencyOS</div>
                <div className="text-slate-400 text-[12px] mt-0.5">Premium CRM Platform</div>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Manage your agency{' '}
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">like a pro</span>
            </h1>
            <p className="text-slate-400 text-[14.5px] leading-relaxed mb-8">The all-in-one CRM built for digital agencies.</p>
            <div className="space-y-3">
              {FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <Icon size={14} className="text-indigo-400" />
                  </div>
                  <span className="text-slate-300 text-[13.5px]">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right panel */}
      <div className="flex flex-col justify-center items-center w-full lg:w-[480px] lg:flex-shrink-0 bg-white dark:bg-slate-900 px-8 py-10">
        <motion.div className="w-full max-w-[360px]" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-sm">AO</div>
            <div className="font-bold text-slate-900 dark:text-white text-lg">AgencyOS</div>
          </div>

          <h2 className="text-[26px] font-bold text-slate-900 dark:text-white mb-1.5">Sign in</h2>
          <p className="text-slate-500 dark:text-slate-400 text-[14px] mb-7">Use a demo account or enter your credentials</p>

          {/* Demo accounts */}
          <div className="space-y-2.5 mb-6">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Quick access — demo accounts</p>
            {DEMO.map(({ user, desc }) => {
              const roleCfg = ROLE_CONFIG[user.role] || {};
              return (
                <motion.button key={user.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  onClick={() => doLogin(user)}
                  className="flex items-center gap-3 w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-800 hover:bg-indigo-50/50 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0" style={{ background: user.color }}>
                    {user.initials}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-[13.5px] text-slate-800 dark:text-slate-200">{user.name}</div>
                    <div className="text-[11.5px] text-slate-500 mt-0.5">{desc}</div>
                  </div>
                  <span className={cn('badge', roleCfg.tw, 'text-[10.5px]')}>{user.role}</span>
                </motion.button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 text-slate-400 text-[12px] mb-6">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            or sign in manually
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Manual form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Email" type="email" placeholder="you@agency.com" error={errors.email?.message}
              {...register('email', { required: 'Email is required' })} />
            <Input label="Password" type="password" placeholder="••••••••" error={errors.password?.message}
              {...register('password', { required: 'Password is required' })} />
            <Button variant="primary" size="lg" loading={loading} className="w-full justify-center mt-2">
              Sign in to AgencyOS
            </Button>
          </form>

          <p className="text-center text-[12px] text-slate-400 mt-5">
            Demo: <span className="font-mono text-slate-600 dark:text-slate-400">admin@agency.com</span> / <span className="font-mono text-slate-600 dark:text-slate-400">admin123</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
