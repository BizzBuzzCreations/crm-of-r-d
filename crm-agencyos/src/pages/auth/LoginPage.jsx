import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { CheckSquare, BarChart3, Users, Zap, Loader2, AlertCircle } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { Input, Button } from '../../components/ui';
import { cn, ROLE_CONFIG } from '../../utils/helpers';

// Demo account quick-login buttons (credentials match seeded data)
/* const DEMO = [
  { name:'Tejash Yadav',  email:'tejash@gmail.com',   password:'tejash',     role:'admin',   initials:'TY', color:'#6366F1', desc:'Your custom admin access' },
 { name:'Alex Johnson',  email:'admin@agency.com',   password:'admin123',   role:'admin',   initials:'AJ', color:'#7C3AED', desc:'Full system access'    },
  { name:'Sarah Chen',    email:'manager@agency.com', password:'manager123', role:'manager', initials:'SC', color:'#0EA5E9', desc:'Team & project access'  },
  { name:'Mike Davis',    email:'member@agency.com',  password:'member123',  role:'member',  initials:'MD', color:'#10B981', desc:'Member access + timer'  },
]; */

const FEATURES = [
  { icon: CheckSquare, text: 'Task & Project Management' },
  { icon: Users, text: 'Client CRM & Relationships' },
  { icon: BarChart3, text: 'Analytics & Reports' },
  { icon: Zap, text: 'Real-time Team Collaboration' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAppStore((s) => s.login);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { register, handleSubmit, setValue, formState: { errors } } = useForm();

  const doLogin = async (email, password) => {
    setErrorMsg('');
    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success(`Welcome back, ${result.user.name.split(' ')[0]}!`);
        navigate('/dashboard');
        return true;
      }
      setErrorMsg(result.message || 'Invalid email or password');
      return false;
    } catch {
      setErrorMsg('Login failed — is the backend running?');
      return false;
    }
  };

  const onSubmit = async ({ email, password }) => {
    setLoading(true);
    await doLogin(email, password);
    setLoading(false);
  };

  const handleDemo = async (acc) => {
    setDemoLoading(acc.email);
    await doLogin(acc.email, acc.password);
    setDemoLoading(null);
  };

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* ── Left hero panel ── */}
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
            <p className="text-slate-400 text-[14.5px] leading-relaxed mb-8">The all-in-one CRM built for digital agencies — powered by a live backend API.</p>
            <div className="space-y-3">
              {FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0"><Icon size={14} className="text-indigo-400" /></div>
                  <span className="text-slate-300 text-[13.5px]">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-col justify-center items-center w-full lg:w-[480px] lg:flex-shrink-0 bg-white dark:bg-slate-900 px-8 py-10">
        <motion.div className="w-full max-w-[360px]" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-sm">AO</div>
            <div className="font-bold text-slate-900 dark:text-white text-lg">AgencyOS</div>
          </div>

          <h2 className="text-[26px] font-bold text-slate-900 dark:text-white mb-1.5">Sign in</h2>
          <p className="text-slate-500 dark:text-slate-400 text-[14px] mb-7">Use a demo account or enter your credentials</p>

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-[12.5px] text-red-600 dark:text-red-400 font-semibold flex items-start gap-2.5 shadow-sm"
            >
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          {/* Demo accounts */}
          {/* <div className="space-y-2.5 mb-6">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Quick access — demo accounts</p>
            {DEMO.map((acc) => {
              const roleCfg = ROLE_CONFIG[acc.role] || {};
              const isLoading = demoLoading === acc.email;
              return (
                <motion.button key={acc.email} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  onClick={() => handleDemo(acc)}
                  disabled={!!demoLoading || loading}
                  className="flex items-center gap-3 w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-800 hover:bg-indigo-50/50 transition-all text-left disabled:opacity-60"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0" style={{ background: acc.color }}>
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : acc.initials}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-[13.5px] text-slate-800 dark:text-slate-200">{acc.name}</div>
                    <div className="text-[11.5px] text-slate-500 mt-0.5">{acc.desc}</div>
                  </div>
                  <span className={cn('badge', roleCfg.tw, 'text-[10.5px]')}>{acc.role}</span>
                </motion.button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-slate-400 text-[12px] mb-6">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" /> or sign in manually <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div> */}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Email" type="email" placeholder="you@agency.com" error={errors.email?.message}
              {...register('email', { required: 'Email is required' })} />
            <Input label="Password" type="password" placeholder="••••••••" error={errors.password?.message}
              {...register('password', { required: 'Password is required' })} />
            <Button variant="primary" size="lg" loading={loading} className="w-full justify-center mt-2" type="submit">
              Sign in to AgencyOS
            </Button>
          </form>

          <p className="text-center text-[12px] text-slate-400 mt-5">
            Login: <span className="font-mono">dev@bizzbuzzcreations.com</span> / <span className="font-mono">bbc655</span>
          </p>
          <p className="text-center text-[11px] text-slate-400 mt-1.5">
            ⚡ Make sure your backend is running on <span className="font-mono">localhost:5000</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}