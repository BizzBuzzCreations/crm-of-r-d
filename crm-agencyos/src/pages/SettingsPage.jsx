import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Download, AlertTriangle, RefreshCw, Save, Lock, User, Bell, Database, Clock, 
  Layers, Plus, Trash2, X, Edit2, Zap, Palette, Smartphone, Globe, BarChart3, 
  PenTool, Clapperboard, Camera, Wrench, Lightbulb, Shield, Rocket, HelpCircle, 
  Mail, Calendar, Users, Sliders, FileText, Check, Settings, Code, Info, ArrowUpRight
} from 'lucide-react';
import useAppStore, { getId, sameId } from '../store/useAppStore';
import { useShallow } from 'zustand/shallow';
import { Page, Toggle, Button } from '../components/ui';
import { cn, canManage, canAdmin, fmtDate, fmtTimer, ROLE_CONFIG } from '../utils/helpers';

// ── Shared Helper: CSV / JSON Downloader ───────────────────────────
function downloadCSV(rows, filename) {
  const csv  = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const PRESET_ICONS = ['⚡', '🎨', '📱', '🌐', '📊', '✍️', '🎬', '📸', '🔧', '💡', '🛡️', '🚀'];
const COLOR_SWATCHES = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6', '#64748b'];

// ───────────────────────────────────────────────────────────────────
// ── Settings Subcomponents
// ───────────────────────────────────────────────────────────────────

// 1. Company Profile & Localization (Admin Only)
function CompanyProfileSection({ settings, onSave }) {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      companyName:     settings?.companyName || 'BizzBuzz Creations',
      defaultTimezone: settings?.defaultTimezone || 'Asia/Kolkata',
      defaultCurrency: settings?.defaultCurrency || 'USD',
      dateFormat:      settings?.dateFormat || 'YYYY-MM-DD',
      timeFormat:      settings?.timeFormat || '12h'
    }
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-6">
      <h3 className="text-[16px] font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
        <Globe size={18} className="text-indigo-500" /> Company Profile & Localization
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Company Name</label>
          <input className="form-input text-[13.5px] py-2" {...register('companyName')} />
        </div>
        <div>
          <label className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Default Timezone</label>
          <select className="form-input text-[13.5px] py-2" {...register('defaultTimezone')}>
            <option value="Asia/Kolkata">India (GMT+5:30) - Asia/Kolkata</option>
            <option value="UTC">UTC (GMT+0)</option>
            <option value="America/New_York">New York (EST) - America/New_York</option>
            <option value="Europe/London">London (BST) - Europe/London</option>
            <option value="Asia/Tokyo">Tokyo (JST) - Asia/Tokyo</option>
          </select>
        </div>
        <div>
          <label className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Default Currency</label>
          <select className="form-input text-[13.5px] py-2" {...register('defaultCurrency')}>
            <option value="USD">USD ($)</option>
            <option value="INR">INR (₹)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </select>
        </div>
        <div>
          <label className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Date Format</label>
          <select className="form-input text-[13.5px] py-2" {...register('dateFormat')}>
            <option value="YYYY-MM-DD">YYYY-MM-DD (2026-05-28)</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY (28/05/2026)</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY (05/28/2026)</option>
          </select>
        </div>
        <div>
          <label className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Time Format</label>
          <select className="form-input text-[13.5px] py-2" {...register('timeFormat')}>
            <option value="12h">12-hour (05:30 PM)</option>
            <option value="24h">24-hour (17:30)</option>
          </select>
        </div>
      </div>
      <Button variant="primary" type="submit" className="mt-2">
        <Save size={14} /> Save Profile Settings
      </Button>
    </form>
  );
}

// 2. Billing & Subscription (Admin Only)
function BillingSubscriptionSection({ settings, onSave }) {
  const [apiLimit, setApiLimit] = useState(settings?.billingLimitApi || 50000);
  const [storageLimit, setStorageLimit] = useState(settings?.billingLimitStorage || 100);

  const handleSave = () => {
    onSave({ billingLimitApi: Number(apiLimit), billingLimitStorage: Number(storageLimit) });
  };

  const mockInvoices = [
    { id: 'INV-2026-003', date: '2026-05-01', amount: '$499.00', status: 'Paid' },
    { id: 'INV-2026-002', date: '2026-04-01', amount: '$499.00', status: 'Paid' },
    { id: 'INV-2026-001', date: '2026-03-01', amount: '$499.00', status: 'Paid' }
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-[16px] font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
        <Rocket size={18} className="text-indigo-500" /> Billing & Plan Subscription
      </h3>

      <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="badge badge-purple uppercase tracking-widest text-[10.5px] px-2.5 py-0.5 font-bold mb-2 inline-block">
            {settings?.subscriptionPlan || 'Enterprise Growth'}
          </span>
          <h4 className="text-[17px] font-bold text-slate-800 dark:text-white">Active Plan Status: <span className="text-emerald-500">{settings?.subscriptionStatus || 'Active'}</span></h4>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">Next invoice renewal: June 01, 2026 ($499.00/mo)</p>
        </div>
        <Button variant="outline" className="text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800">Upgrade / Modify Plan</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sliders for limits */}
        <div className="bg-slate-50 dark:bg-slate-900/30 p-5 rounded-xl border border-slate-200 dark:border-slate-800/80">
          <label className="block text-[13.5px] font-bold text-slate-700 dark:text-slate-350 mb-2">Monthly API Call Limits: <span className="text-indigo-600 dark:text-indigo-400">{apiLimit.toLocaleString()} requests</span></label>
          <input 
            type="range" min="1000" max="100000" step="5000"
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700 accent-indigo-500"
            value={apiLimit} onChange={(e) => setApiLimit(e.target.value)} 
          />
          <div className="flex justify-between text-[11px] text-slate-400 mt-2">
            <span>1,000 reqs</span>
            <span>100,000 reqs</span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/30 p-5 rounded-xl border border-slate-200 dark:border-slate-800/80">
          <label className="block text-[13.5px] font-bold text-slate-700 dark:text-slate-350 mb-2">Dynamic Storage Cap: <span className="text-indigo-600 dark:text-indigo-400">{storageLimit} GB</span></label>
          <input 
            type="range" min="10" max="500" step="10"
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700 accent-indigo-500"
            value={storageLimit} onChange={(e) => setStorageLimit(e.target.value)} 
          />
          <div className="flex justify-between text-[11px] text-slate-400 mt-2">
            <span>10 GB</span>
            <span>500 GB</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-200 mb-3">Subscription Invoices History</h4>
        <div className="overflow-x-auto border border-slate-250 dark:border-slate-800 rounded-xl">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/40">
              <tr className="border-b border-slate-250 dark:border-slate-800">
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-3 px-4">Invoice ID</th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-3 px-4">Date</th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-3 px-4">Amount</th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockInvoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-200 dark:border-slate-800/60 last:border-b-0 hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                  <td className="py-3 px-4 text-[13px] font-semibold text-indigo-650 dark:text-indigo-400">{inv.id}</td>
                  <td className="py-3 px-4 text-[13px] text-slate-600 dark:text-slate-450">{inv.date}</td>
                  <td className="py-3 px-4 text-[13px] font-mono text-slate-850 dark:text-slate-200">{inv.amount}</td>
                  <td className="py-3 px-4 text-[13px]"><span className="badge badge-success px-2 py-0.5">{inv.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Button variant="primary" onClick={handleSave}>
        <Save size={14} /> Update Limits & Preferences
      </Button>
    </div>
  );
}

// 3. Security & Authentication Global config (Admin Only)
function SecurityConfigSection({ settings, onSave }) {
  const [ipInput, setIpInput] = useState('');
  const [ipList, setIpList] = useState(settings?.ipWhitelist || []);
  const { register, handleSubmit } = useForm({
    defaultValues: {
      passwordComplexity: settings?.passwordComplexity || 'medium',
      sessionTimeout:     settings?.sessionTimeout || 120,
      enforce2FA:         !!settings?.enforce2FA
    }
  });

  const handleAddIp = () => {
    if (!ipInput.trim()) return;
    if (ipList.includes(ipInput.trim())) return;
    setIpList([...ipList, ipInput.trim()]);
    setIpInput('');
  };

  const handleRemoveIp = (ip) => {
    setIpList(ipList.filter((x) => x !== ip));
  };

  const onSubmit = (data) => {
    onSave({ ...data, ipWhitelist: ipList });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h3 className="text-[16px] font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
        <Shield size={18} className="text-indigo-500" /> Security & Authentication (Global Rules)
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Password Complexity Rules</label>
          <select className="form-input text-[13.5px] py-2" {...register('passwordComplexity')}>
            <option value="low">Low (Min 6 Characters)</option>
            <option value="medium">Medium (Min 8 Characters + Numbers)</option>
            <option value="high">High (Min 8 Characters + Caps/Special Symbols)</option>
          </select>
        </div>
        <div>
          <label className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Session Timeout (Minutes)</label>
          <input type="number" className="form-input text-[13.5px] py-2" {...register('sessionTimeout')} />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
        <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-200 mb-2">Two-Factor Authentication (2FA)</h4>
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-slate-500 dark:text-slate-400">Enforce all CRM team members and sales representatives to complete 2FA login verification.</p>
          <input type="checkbox" className="w-5 h-5 accent-indigo-500" {...register('enforce2FA')} />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
        <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-200 mb-1.5">Whitelisted Corporate IPs</h4>
        <p className="text-[12.5px] text-slate-400 mb-3">Add static office IP addresses to restrict database access. Keep empty to permit login from anywhere.</p>
        <div className="flex gap-2 mb-3">
          <input 
            placeholder="e.g. 192.168.1.155" 
            className="form-input text-[13px] py-1.5 max-w-sm" 
            value={ipInput} onChange={(e) => setIpInput(e.target.value)} 
          />
          <Button variant="outline" type="button" onClick={handleAddIp}><Plus size={14} /> Whitelist IP</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {ipList.length === 0 ? (
            <span className="text-[12.5px] text-slate-400 italic">No IPs whitelisted yet. Global access enabled.</span>
          ) : (
            ipList.map((ip) => (
              <span key={ip} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12.5px] font-semibold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-750 dark:text-indigo-350 border border-indigo-100 dark:border-indigo-950">
                {ip}
                <button type="button" onClick={() => handleRemoveIp(ip)} className="hover:text-red-500"><X size={12} /></button>
              </span>
            ))
          )}
        </div>
      </div>

      <Button variant="primary" type="submit">
        <Save size={14} /> Update Authentication Controls
      </Button>
    </form>
  );
}

// 4. Pipelines & Sales Funnel stages (Admin Only)
function PipelinesStagesSection({ settings, onSave }) {
  const [stages, setStages] = useState(settings?.pipelines?.[0]?.stages || []);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#6366f1');
  const [newStageProb, setNewStageProb] = useState(50);

  const [lostReasons, setLostReasons] = useState(settings?.pipelines?.[0]?.lostReasons || []);
  const [lostInput, setLostInput] = useState('');

  const [wonReasons, setWonReasons] = useState(settings?.pipelines?.[0]?.wonReasons || []);
  const [wonInput, setWonInput] = useState('');

  const handleAddStage = () => {
    if (!newStageName.trim()) return;
    setStages([...stages, { 
      name: newStageName.trim(), 
      color: newStageColor, 
      probability: Number(newStageProb) 
    }]);
    setNewStageName('');
    setNewStageColor('#6366f1');
    setNewStageProb(50);
  };

  const handleRemoveStage = (index) => {
    setStages(stages.filter((_, i) => i !== index));
  };

  const handleAddLost = () => {
    if (!lostInput.trim()) return;
    if (lostReasons.includes(lostInput.trim())) return;
    setLostReasons([...lostReasons, lostInput.trim()]);
    setLostInput('');
  };

  const handleAddWon = () => {
    if (!wonInput.trim()) return;
    if (wonReasons.includes(wonInput.trim())) return;
    setWonReasons([...wonReasons, wonInput.trim()]);
    setWonInput('');
  };

  const handleSave = () => {
    onSave({
      pipelines: [{
        name: 'Sales Funnel',
        stages,
        lostReasons,
        wonReasons
      }]
    });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-[16px] font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
        <Sliders size={18} className="text-indigo-500" /> Pipeline Stages & Deal Funnel Customizer
      </h3>

      <div className="space-y-4">
        <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-250">Deal Pipeline Progress Stages</h4>
        
        {/* Render stages */}
        <div className="flex flex-col gap-2">
          {stages.map((st, i) => (
            <div key={i} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
              <div className="flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: st.color }} />
                <span className="text-[14px] font-bold text-slate-800 dark:text-slate-200">{st.name}</span>
                <span className="text-[12px] px-2 py-0.5 rounded-full bg-slate-200/50 dark:bg-slate-800 text-slate-500 font-semibold">{st.probability}% Prob</span>
              </div>
              <button 
                onClick={() => handleRemoveStage(i)} 
                className="text-slate-400 hover:text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Add Stage fields */}
        <div className="bg-slate-100/50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-750 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[12.5px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Stage Name</label>
            <input 
              placeholder="e.g. Qualified Lead" 
              className="form-input text-[13px] py-1.5" 
              value={newStageName} onChange={(e) => setNewStageName(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Prob (%)</label>
            <input 
              type="number" min="0" max="100" 
              className="form-input text-[13px] py-1.5 w-20" 
              value={newStageProb} onChange={(e) => setNewStageProb(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Color</label>
            <div className="flex items-center gap-1.5 h-10">
              <input type="color" className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" value={newStageColor} onChange={(e) => setNewStageColor(e.target.value)} />
            </div>
          </div>
          <Button variant="outline" onClick={handleAddStage} className="h-10 px-4"><Plus size={14} /> Add Stage</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lost Reasons */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800">
          <h4 className="text-[13.5px] font-bold text-slate-800 dark:text-slate-200 mb-2">Deal Closed Lost Reasons</h4>
          <div className="flex gap-2 mb-3">
            <input 
              placeholder="e.g. Budget Freeze" 
              className="form-input text-[13px] py-1.5" 
              value={lostInput} onChange={(e) => setLostInput(e.target.value)} 
            />
            <Button variant="outline" type="button" onClick={handleAddLost}><Plus size={13} /></Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lostReasons.map((lr) => (
              <span key={lr} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-[12px] font-medium border border-red-100 dark:border-red-950">
                {lr}
                <button type="button" onClick={() => setLostReasons(lostReasons.filter(x => x !== lr))} className="hover:text-red-900"><X size={10} /></button>
              </span>
            ))}
          </div>
        </div>

        {/* Won Reasons */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800">
          <h4 className="text-[13.5px] font-bold text-slate-800 dark:text-slate-200 mb-2">Deal Closed Won Reasons</h4>
          <div className="flex gap-2 mb-3">
            <input 
              placeholder="e.g. Premium Support" 
              className="form-input text-[13px] py-1.5" 
              value={wonInput} onChange={(e) => setWonInput(e.target.value)} 
            />
            <Button variant="outline" type="button" onClick={handleAddWon}><Plus size={13} /></Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {wonReasons.map((wr) => (
              <span key={wr} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[12px] font-medium border border-emerald-100 dark:border-emerald-950">
                {wr}
                <button type="button" onClick={() => setWonReasons(wonReasons.filter(x => x !== wr))} className="hover:text-emerald-950"><X size={10} /></button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <Button variant="primary" onClick={handleSave}>
        <Save size={14} /> Persist Pipeline Configuration
      </Button>
    </div>
  );
}

// 5. Custom Fields Config (Admin Only)
function CustomFieldsSection({ settings, onSave }) {
  const [fields, setFields] = useState(settings?.customFields || []);
  const [module, setModule] = useState('Contacts');
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState('text');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState('');

  const handleAddField = () => {
    if (!name.trim() || !label.trim()) {
      toast.error('Field name and label are required');
      return;
    }
    const newField = {
      module,
      name: name.trim().replace(/\s+/g, '_').toLowerCase(),
      label: label.trim(),
      type,
      required,
      options: options ? options.split(',').map(o => o.trim()) : []
    };
    setFields([...fields, newField]);
    setName('');
    setLabel('');
    setOptions('');
    setRequired(false);
  };

  const handleRemoveField = (index) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({ customFields: fields });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-[16px] font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
        <Code size={18} className="text-indigo-500" /> Database Custom Fields Configuration
      </h3>

      <div className="space-y-4">
        <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-200">Active Database Extensible Fields</h4>
        
        {fields.length === 0 ? (
          <p className="text-[13px] text-slate-400 italic">No custom fields have been added yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {fields.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-900/30">
                <div>
                  <span className="badge badge-indigo text-[10px] font-bold px-2 py-0.5 mr-2">{f.module}</span>
                  <span className="text-[14px] font-bold text-slate-800 dark:text-slate-200">{f.label} ({f.name})</span>
                  <span className="text-[12px] text-slate-450 ml-3">Type: <span className="capitalize">{f.type}</span> {f.required && <span className="text-amber-500 font-bold">*Required</span>}</span>
                </div>
                <button 
                  onClick={() => handleRemoveField(i)} 
                  className="text-slate-400 hover:text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add custom fields form */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-750 space-y-4">
          <h5 className="text-[13.5px] font-bold text-slate-800 dark:text-slate-200">Create Extensible Custom Input Field</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Target CRM Module</label>
              <select className="form-input text-[13px] py-1.5" value={module} onChange={(e) => setModule(e.target.value)}>
                <option value="Contacts">Contacts / Client Representatives</option>
                <option value="Companies">Companies / Corporate Clients</option>
                <option value="Deals">Deals & Opportunities</option>
              </select>
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Field Label (Visible)</label>
              <input placeholder="e.g. Secondary Contact" className="form-input text-[13px] py-1.5" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Field DB Name (API)</label>
              <input placeholder="e.g. secondary_contact" className="form-input text-[13px] py-1.5" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Field Type</label>
              <select className="form-input text-[13px] py-1.5" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="text">Single Line Text</option>
                <option value="number">Numeric Value</option>
                <option value="date">Date Picker</option>
                <option value="boolean">Checkbox / Toggle</option>
                <option value="select">Dropdown Select</option>
              </select>
            </div>
            {type === 'select' && (
              <div className="sm:col-span-2">
                <label className="block text-[12.5px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Dropdown Options (Comma separated)</label>
                <input placeholder="Option 1, Option 2, Option 3" className="form-input text-[13px] py-1.5" value={options} onChange={(e) => setOptions(e.target.value)} />
              </div>
            )}
            <div className="flex items-center gap-2 h-10 mt-6">
              <input type="checkbox" id="reqCheckbox" className="w-4 h-4 accent-indigo-500" checked={required} onChange={(e) => setRequired(e.target.checked)} />
              <label htmlFor="reqCheckbox" className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-350 cursor-pointer">Enforce Required</label>
            </div>
          </div>
          <Button variant="outline" onClick={handleAddField} className="px-4"><Plus size={14} className="mr-1" /> Add Custom Field</Button>
        </div>
      </div>

      <Button variant="primary" onClick={handleSave}>
        <Save size={14} /> Update Extensible Modules
      </Button>
    </div>
  );
}

// 6. User invite & Dynamic Teams (Admins & Managers)
function TeamsManagementSection({ settings, onSave, users, onInvite }) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [teams, setTeams] = useState(settings?.teams || []);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');

  // Staffing metadata config

  const [depList, setDepList] = useState(settings?.departments || []);
  const [newDep, setNewDep] = useState('');

  const [indList, setIndList] = useState(settings?.industries || []);
  const [newInd, setNewInd] = useState('');

  // Sync state if settings changes
  useEffect(() => {
    if (settings) {
      setTeams(settings.teams || []);
      setDepList(settings.departments || []);
      setIndList(settings.industries || []);
    }
  }, [settings]);

  // Form hooks for Invite modal
  const { register, handleSubmit, reset } = useForm();

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) return;
    setTeams([...teams, { name: newTeamName.trim(), description: newTeamDesc.trim() }]);
    setNewTeamName('');
    setNewTeamDesc('');
  };



  const handleAddDep = () => {
    if (!newDep.trim()) return;
    const dep = newDep.trim();
    if (depList.includes(dep)) {
      toast.error('Department already exists');
      return;
    }
    setDepList([...depList, dep]);
    setNewDep('');
  };

  const handleRemoveDep = (dep) => {
    if (dep === 'Management' || dep === 'General') {
      toast.error('Core departments cannot be deleted');
      return;
    }
    setDepList(depList.filter((d) => d !== dep));
  };

  const handleAddInd = () => {
    if (!newInd.trim()) return;
    const ind = newInd.trim();
    if (indList.includes(ind)) {
      toast.error('Industry already exists');
      return;
    }
    setIndList([...indList, ind]);
    setNewInd('');
  };

  const handleRemoveInd = (ind) => {
    setIndList(indList.filter((x) => x !== ind));
  };

  const handleSaveAllFramework = () => {
    onSave({ 
      teams, 
      departments: depList, 
      industries: indList 
    });
  };

  const handleInviteSubmit = async (data) => {
    try {
      await onInvite(data);
      setShowInviteModal(false);
      reset();
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700/60">
        <h3 className="text-[16px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users size={18} className="text-indigo-500" /> Users & Dynamic Teams Management
        </h3>
        <Button variant="primary" onClick={() => setShowInviteModal(true)}>
          <Plus size={14} /> Invite New Member
        </Button>
      </div>

      {/* Users list with details */}
      <div className="space-y-3">
        <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-200">Active Agency Staff & Members</h4>
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-850">
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-455 py-3 px-4">Member</th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-455 py-3 px-4">Email</th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-455 py-3 px-4">Role</th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-455 py-3 px-4">Department</th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-455 py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                return (
                  <tr key={u._id} className="border-b border-slate-200 dark:border-slate-800/60 last:border-b-0 hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full text-white font-bold flex items-center justify-center text-[12px]" style={{ background: u.color || '#6366f1' }}>
                          {u.initials || 'U'}
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200">{u.name}</p>
                          <p className="text-[11.5px] text-slate-450">{u.position || 'Representative'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[13px] text-slate-600 dark:text-slate-400">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={cn('badge text-[11px]', ROLE_CONFIG[u.role]?.tw || 'badge-neutral')}>
                        {ROLE_CONFIG[u.role]?.label || u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[13px] text-slate-600 dark:text-slate-400">{u.department || 'General'}</td>
                    <td className="py-3 px-4">
                      <span className={cn('inline-flex items-center gap-1 text-[11.5px] font-bold', u.status === 'online' ? 'text-emerald-500' : u.status === 'away' ? 'text-amber-500' : 'text-slate-400')}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', u.status === 'online' ? 'bg-emerald-500' : u.status === 'away' ? 'bg-amber-500' : 'bg-slate-400')} />
                        {u.status || 'offline'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>


      {/* Teams list */}
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-850">
        <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-200">Custom Dynamic Teams</h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {teams.map((t, i) => (
            <div key={i} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex items-start justify-between">
              <div>
                <p className="text-[14px] font-bold text-slate-800 dark:text-slate-200">{t.name}</p>
                <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-1">{t.description || 'No description provided.'}</p>
              </div>
              <button 
                onClick={() => setTeams(teams.filter((_, idx) => idx !== i))} 
                className="text-slate-400 hover:text-red-500 p-1"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* Create team inputs */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-750 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[12.5px] font-semibold text-slate-650 dark:text-slate-450 mb-1">Team Name</label>
            <input placeholder="e.g. Sales Team East" className="form-input text-[13px] py-1.5" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
          </div>
          <div className="flex-[2] min-w-[300px]">
            <label className="block text-[12.5px] font-semibold text-slate-655 dark:text-slate-455 mb-1">Description / Focus</label>
            <input placeholder="e.g. East coast outreach, enterprise deals" className="form-input text-[13px] py-1.5" value={newTeamDesc} onChange={(e) => setNewTeamDesc(e.target.value)} />
          </div>
          <Button variant="outline" className="h-10" onClick={handleCreateTeam}><Plus size={14} /> Create Team</Button>
        </div>
      </div>

      <Button variant="primary" onClick={handleSaveAllFramework}>
        <Save size={14} /> Save Staff & Organization Framework
      </Button>

      {/* Invite Member modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-[16px] font-bold text-slate-900 dark:text-white">Invite CRM Member</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit(handleInviteSubmit)}>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-350 mb-1">Full Name</label>
                  <input className="form-input text-[13px] py-2" required {...register('name')} placeholder="e.g. Alice Cooper" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-350 mb-1">Email Address</label>
                  <input type="email" className="form-input text-[13px] py-2" required {...register('email')} placeholder="e.g. alice@bizzbuzz.com" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-350 mb-1">Role</label>
                    <select className="form-input text-[13px] py-2" {...register('role')}>
                      <option value="member">Member</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      <option value="client_relations">Client Relations</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-350 mb-1">Department</label>
                    <select className="form-input text-[13px] py-2" {...register('department')}>
                      {depList.map((dep) => (
                        <option key={dep} value={dep}>{dep}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-350 mb-1">Position / Title</label>
                  <input className="form-input text-[13px] py-2" {...register('position')} placeholder="e.g. Sales Specialist" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                <Button variant="ghost" type="button" onClick={() => setShowInviteModal(false)}>Cancel</Button>
                <Button variant="primary" type="submit">Invite Member</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// 7. Lead & Task Assignment Rules (Admins & Managers)
function AssignmentRulesSection({ settings, onSave }) {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      leadDistribution:    settings?.assignmentRules?.leadDistribution || 'round-robin',
      activeSalesRepsOnly: !!settings?.assignmentRules?.activeSalesRepsOnly
    }
  });

  return (
    <form onSubmit={handleSubmit((data) => onSave({ assignmentRules: data }))} className="space-y-6">
      <h3 className="text-[16px] font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
        <Sliders size={18} className="text-indigo-500" /> Automatic Lead & Task Assignment Rules
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Lead Distribution Algorithm</label>
          <select className="form-input text-[13.5px] py-2 max-w-md" {...register('leadDistribution')}>
            <option value="none">Manual Assign Only (No Auto-distribution)</option>
            <option value="round-robin">Round-Robin (Fair and sequential distribution)</option>
            <option value="least-loaded">Least-Loaded (Assigns to rep with fewest open tasks)</option>
          </select>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between max-w-2xl">
          <div>
            <h4 className="text-[13.5px] font-bold text-slate-800 dark:text-slate-200">Active Reps Only</h4>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">Only assign incoming clients and leads to representatives who are currently online or active.</p>
          </div>
          <input type="checkbox" className="w-5 h-5 accent-indigo-500 flex-shrink-0 ml-4" {...register('activeSalesRepsOnly')} />
        </div>
      </div>

      <Button variant="primary" type="submit">
        <Save size={14} /> Update Assignment Rules
      </Button>
    </form>
  );
}

// 8. Shared Email & Snippet Templates (Admins & Managers)
function TemplatesSection({ settings, onSave }) {
  const [templates, setTemplates] = useState(settings?.emailTemplates || []);
  const [tName, setTName] = useState('');
  const [tSubject, setTSubject] = useState('');
  const [tBody, setTBody] = useState('');

  const [snippets, setSnippets] = useState(settings?.snippetLibrary || []);
  const [sTrigger, setSTrigger] = useState('');
  const [sText, setSText] = useState('');

  const handleAddTemplate = () => {
    if (!tName.trim() || !tSubject.trim() || !tBody.trim()) {
      toast.error('All template fields are required');
      return;
    }
    setTemplates([...templates, { name: tName.trim(), subject: tSubject.trim(), body: tBody.trim() }]);
    setTName('');
    setTSubject('');
    setTBody('');
  };

  const handleAddSnippet = () => {
    if (!sTrigger.trim() || !sText.trim()) {
      toast.error('Snippet trigger and replacement are required');
      return;
    }
    setSnippets([...snippets, { trigger: sTrigger.trim(), text: sText.trim() }]);
    setSTrigger('');
    setSText('');
  };

  const handleSave = () => {
    onSave({ emailTemplates: templates, snippetLibrary: snippets });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-[16px] font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
        <FileText size={18} className="text-indigo-500" /> Shared Communication Templates & Snippets
      </h3>

      <div className="space-y-4">
        <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-250">Shared Email Templates</h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {templates.map((t, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-900/30 flex flex-col justify-between">
              <div>
                <p className="text-[14px] font-bold text-slate-800 dark:text-slate-250">{t.name}</p>
                <p className="text-[12px] font-semibold text-indigo-500 mt-0.5">Subj: {t.subject}</p>
                <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-3 whitespace-pre-line">{t.body}</p>
              </div>
              <div className="flex justify-end mt-4">
                <button onClick={() => setTemplates(templates.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add template fields */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-250 dark:border-slate-750 space-y-3">
          <p className="text-[13px] font-bold text-slate-800 dark:text-slate-250">Create Shared Email Template</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Template Name (e.g. Intro)" className="form-input text-[13px] py-1.5" value={tName} onChange={(e) => setTName(e.target.value)} />
            <input placeholder="Email Subject" className="form-input text-[13px] py-1.5" value={tSubject} onChange={(e) => setTSubject(e.target.value)} />
          </div>
          <textarea placeholder="Write email body text..." className="form-input text-[13px] py-2 h-20 resize-none" value={tBody} onChange={(e) => setTBody(e.target.value)} />
          <Button variant="outline" onClick={handleAddTemplate} className="px-3 py-1.5"><Plus size={13} className="mr-1" /> Add Template</Button>
        </div>
      </div>

      <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-850">
        <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-250">Shared Snippets Library</h4>

        <div className="flex flex-wrap gap-2">
          {snippets.map((sn, idx) => (
            <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[12.5px] text-slate-700 dark:text-slate-350">
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{sn.trigger}</span>
              <span className="text-slate-300">|</span>
              <span className="truncate max-w-[150px]">{sn.text}</span>
              <button onClick={() => setSnippets(snippets.filter((_, i) => i !== idx))} className="hover:text-red-500"><X size={12} /></button>
            </span>
          ))}
        </div>

        {/* Add snippet form */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-250 dark:border-slate-750 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[12px] font-semibold text-slate-500 mb-1">Trigger Keyword</label>
            <input placeholder="e.g. ;greet" className="form-input text-[13px] py-1.5 w-32 font-mono" value={sTrigger} onChange={(e) => setSTrigger(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[12px] font-semibold text-slate-500 mb-1">Replacement Text</label>
            <input placeholder="e.g. Thanks for choosing BizzBuzz!" className="form-input text-[13px] py-1.5" value={sText} onChange={(e) => setSText(e.target.value)} />
          </div>
          <Button variant="outline" onClick={handleAddSnippet} className="h-9"><Plus size={13} /> Add Snippet</Button>
        </div>
      </div>

      <Button variant="primary" onClick={handleSave}>
        <Save size={14} /> Update Shared Communication Templates
      </Button>
    </div>
  );
}

// 9. Data Import/Export Control (Admins & Managers)
function DataControlSection({ settings, onSave, onExportTasks, onExportTodos, onExportClients, onFullBackup }) {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      allowBulkImport:    !!settings?.dataControl?.allowBulkImport,
      allowExportClients: !!settings?.dataControl?.allowExportClients,
      allowExportTasks:   !!settings?.dataControl?.allowExportTasks
    }
  });

  return (
    <div className="space-y-6">
      <h3 className="text-[16px] font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
        <Database size={18} className="text-indigo-500" /> Data Governance & Export Controls
      </h3>

      <form onSubmit={handleSubmit((data) => onSave({ dataControl: data }))} className="space-y-4">
        <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-250">Data Security Controls</h4>
        
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 space-y-3.5 max-w-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13.5px] font-bold text-slate-850 dark:text-slate-200">Bulk Import via CSV</p>
              <p className="text-[12.5px] text-slate-500">Permit administrators and operational managers to bulk-import CSV data models.</p>
            </div>
            <input type="checkbox" className="w-5 h-5 accent-indigo-500" {...register('allowBulkImport')} />
          </div>
          
          <div className="border-t border-slate-200 dark:border-slate-800/80 pt-3 flex items-center justify-between">
            <div>
              <p className="text-[13.5px] font-bold text-slate-850 dark:text-slate-200">Export Client Portfolio Records</p>
              <p className="text-[12.5px] text-slate-500">Restricts client databases downloading to prevent unauthorized leakage.</p>
            </div>
            <input type="checkbox" className="w-5 h-5 accent-indigo-500" {...register('allowExportClients')} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800/80 pt-3 flex items-center justify-between">
            <div>
              <p className="text-[13.5px] font-bold text-slate-850 dark:text-slate-200">Export Tasks & Worklog Records</p>
              <p className="text-[12.5px] text-slate-500">Allow team member task and performance logs exporting in CSV format.</p>
            </div>
            <input type="checkbox" className="w-5 h-5 accent-indigo-500" {...register('allowExportTasks')} />
          </div>
        </div>
        <Button variant="primary" type="submit">Update Data Controls</Button>
      </form>

      {/* Actual Export rows */}
      <div className="space-y-3 pt-6 border-t border-slate-200 dark:border-slate-850">
        <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-250">Download Database Backups</h4>
        
        <div className="flex flex-col gap-2 max-w-xl">
          <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-850">
            <div>
              <p className="text-[13.5px] font-semibold text-slate-850 dark:text-slate-200">Export Tasks List</p>
              <p className="text-[12px] text-slate-450">Download active CRM tasks table in CSV</p>
            </div>
            <Button variant="outline" size="sm" onClick={onExportTasks} disabled={!settings?.dataControl?.allowExportTasks}><Download size={13} /> Export CSV</Button>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-850">
            <div>
              <p className="text-[13.5px] font-semibold text-slate-850 dark:text-slate-200">Export Daily Todos</p>
              <p className="text-[12px] text-slate-450">Download internal daily schedules in CSV</p>
            </div>
            <Button variant="outline" size="sm" onClick={onExportTodos}><Download size={13} /> Export CSV</Button>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-850">
            <div>
              <p className="text-[13.5px] font-semibold text-slate-850 dark:text-slate-200">Export Clients Portfolio</p>
              <p className="text-[12px] text-slate-450">Download full client directory details in CSV</p>
            </div>
            <Button variant="outline" size="sm" onClick={onExportClients} disabled={!settings?.dataControl?.allowExportClients}><Download size={13} /> Export CSV</Button>
          </div>

          <div className="flex items-center justify-between py-3 last:border-0">
            <div>
              <p className="text-[13.5px] font-semibold text-slate-850 dark:text-slate-200">Full Workspace Database Backup</p>
              <p className="text-[12px] text-slate-450">Download entire workspace configuration in JSON</p>
            </div>
            <Button variant="outline" size="sm" onClick={onFullBackup}><Download size={13} /> Backup JSON</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 10. Integrations management (Admins & Managers)
function IntegrationsSection({ settings, onSave }) {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      slackEnabled:                !!settings?.integrations?.slackEnabled,
      slackWebhookUrl:             settings?.integrations?.slackWebhookUrl || '',
      voipEnabled:                 !!settings?.integrations?.voipEnabled,
      marketingAutomationEnabled:  !!settings?.integrations?.marketingAutomationEnabled
    }
  });

  return (
    <form onSubmit={handleSubmit((data) => onSave({ integrations: data }))} className="space-y-6">
      <h3 className="text-[16px] font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
        <Zap size={18} className="text-indigo-500" /> Third-Party Workspace Integrations
      </h3>

      <div className="space-y-5 max-w-2xl">
        {/* Slack */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <h4 className="text-[14px] font-bold text-slate-850 dark:text-slate-200">Slack Notifications Feed</h4>
            </div>
            <input type="checkbox" className="w-5 h-5 accent-indigo-500" {...register('slackEnabled')} />
          </div>
          <p className="text-[12.5px] text-slate-550 dark:text-slate-400">Dispatch live updates to your Slack workgroups whenever client projects, deals, or tasks change.</p>
          <input 
            placeholder="e.g. https://hooks.slack.com/services/..." 
            className="form-input text-[13px] py-1.5" 
            {...register('slackWebhookUrl')} 
          />
        </div>

        {/* VoIP */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex items-center justify-between">
          <div>
            <h4 className="text-[14px] font-bold text-slate-850 dark:text-slate-200">Integrated VoIP Calling System</h4>
            <p className="text-[12.5px] text-slate-550 dark:text-slate-400 mt-1">Connect corporate Twilio / VoIP services to trigger clicks-to-call direct from client directory grids.</p>
          </div>
          <input type="checkbox" className="w-5 h-5 accent-indigo-500 ml-4 flex-shrink-0" {...register('voipEnabled')} />
        </div>

        {/* Marketing Automation */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex items-center justify-between">
          <div>
            <h4 className="text-[14px] font-bold text-slate-850 dark:text-slate-200">Marketing & Email Automation Platform</h4>
            <p className="text-[12.5px] text-slate-550 dark:text-slate-400 mt-1">Sync contacts data blocks with Mailchimp/Hubspot campaign setups dynamically.</p>
          </div>
          <input type="checkbox" className="w-5 h-5 accent-indigo-500 ml-4 flex-shrink-0" {...register('marketingAutomationEnabled')} />
        </div>
      </div>

      <Button variant="primary" type="submit">
        <Save size={14} /> Save Enabled Integrations
      </Button>
    </form>
  );
}

// 11. Personal Profile Settings (All Members)
function PersonalProfileSection({ user, onUpdate }) {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name:  user?.name  || '',
      email: user?.email || '',
      phone: user?.phone || '',
      bio:   user?.bio   || ''
    }
  });

  const [color, setColor] = useState(user?.color || '#6366f1');

  const onSubmit = (data) => {
    onUpdate({ ...data, color });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h3 className="text-[16px] font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
        <User size={18} className="text-indigo-500" /> Individual Agent Workspace Profile
      </h3>

      <div className="flex items-center gap-4 mb-3">
        <div 
          className="w-14 h-14 rounded-full flex items-center justify-center text-white text-[20px] font-bold shadow-sm"
          style={{ background: color }}
        >
          {user?.name?.[0] || 'U'}
        </div>
        <div>
          <p className="text-[15.5px] font-bold text-slate-900 dark:text-white">{user?.name}</p>
          <span className="badge badge-purple uppercase tracking-wider text-[9.5px] font-bold inline-block mt-0.5">{user?.role}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Full Name</label>
          <input className="form-input text-[13.5px] py-2" {...register('name')} />
        </div>
        <div>
          <label className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Work Email</label>
          <input type="email" className="form-input text-[13.5px] py-2" {...register('email')} />
        </div>
        <div>
          <label className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Contact Number</label>
          <input className="form-input text-[13.5px] py-2" {...register('phone')} />
        </div>
        <div>
          <label className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Personal Avatar Accent Color</label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c} type="button" onClick={() => setColor(c)}
                className={cn('w-7 h-7 rounded-full border-2 transition-all', color === c ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent hover:scale-105')}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Short Bio</label>
          <textarea rows={3} className="form-input text-[13.5px] py-2 resize-none" {...register('bio')} placeholder="Write a short summary about yourself..." />
        </div>
      </div>

      <Button variant="primary" type="submit">
        <Save size={14} /> Update Profile
      </Button>
    </form>
  );
}

// 12. Email & Calendar synchronization (All Members)
function EmailCalendarSyncSection({ user, onUpdate }) {
  const [provider, setProvider] = useState(user?.emailSync?.provider || 'none');
  const [calendarSync, setCalendarSync] = useState(!!user?.calendarSyncEnabled);

  const { register, handleSubmit } = useForm({
    defaultValues: {
      email:    user?.emailSync?.email || '',
      imapHost: user?.emailSync?.imapHost || '',
      imapPort: user?.emailSync?.imapPort || 993,
      smtpHost: user?.emailSync?.smtpHost || '',
      smtpPort: user?.emailSync?.smtpPort || 465
    }
  });

  const onSubmit = (data) => {
    onUpdate({
      emailSync: {
        provider,
        ...data
      },
      calendarSyncEnabled: calendarSync
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h3 className="text-[16px] font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
        <Mail size={18} className="text-indigo-500" /> Work Email & Calendar Synchronizer
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-350 mb-2">Primary Sync Provider</label>
          <div className="flex flex-wrap gap-3">
            {[
              { id: 'none', label: 'Disconnected' },
              { id: 'google', label: 'Google Workspace' },
              { id: 'outlook', label: 'Microsoft Exchange / Outlook' },
              { id: 'smtp', label: 'Custom IMAP / SMTP Host' }
            ].map((p) => (
              <button 
                key={p.id} type="button" onClick={() => setProvider(p.id)}
                className={cn('px-4 py-2.5 rounded-xl border text-[13px] font-semibold transition-all', provider === p.id ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-650 dark:text-indigo-350 border-indigo-400 dark:border-indigo-850' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50')}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {provider === 'smtp' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-2xl border border-slate-205 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 max-w-2xl">
            <div className="md:col-span-2">
              <label className="block text-[13px] font-semibold text-slate-600 dark:text-slate-400 mb-1">IMAP/SMTP Mail Account</label>
              <input type="email" placeholder="user@company.com" className="form-input text-[13px] py-1.5" {...register('email')} />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-600 dark:text-slate-400 mb-1">IMAP Incoming Server</label>
              <input placeholder="imap.company.com" className="form-input text-[13px] py-1.5" {...register('imapHost')} />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-600 dark:text-slate-400 mb-1">IMAP SSL Port</label>
              <input type="number" className="form-input text-[13px] py-1.5" {...register('imapPort')} />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-600 dark:text-slate-400 mb-1">SMTP Outgoing Server</label>
              <input placeholder="smtp.company.com" className="form-input text-[13px] py-1.5" {...register('smtpHost')} />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-600 dark:text-slate-400 mb-1">SMTP SSL Port</label>
              <input type="number" className="form-input text-[13px] py-1.5" {...register('smtpPort')} />
            </div>
          </div>
        )}

        {(provider === 'google' || provider === 'outlook') && (
          <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-950 bg-indigo-50/30 dark:bg-indigo-900/10 flex items-center justify-between max-w-xl">
            <span className="text-[13px] text-slate-600 dark:text-slate-350">Sync account is authorized via secure modern OAuth connection.</span>
            <Button variant="outline" className="border-indigo-200 dark:border-indigo-900 text-indigo-650 dark:text-indigo-400">Re-Authorize</Button>
          </div>
        )}

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 flex items-center justify-between max-w-xl">
          <div>
            <h4 className="text-[13.5px] font-bold text-slate-850 dark:text-slate-200">Calendar Sync Integration</h4>
            <p className="text-[12px] text-slate-500 mt-0.5">Permit the CRM to read your calendar availability and create invite bookings instantly.</p>
          </div>
          <input type="checkbox" className="w-5 h-5 accent-indigo-500" checked={calendarSync} onChange={(e) => setCalendarSync(e.target.checked)} />
        </div>
      </div>

      <Button variant="primary" type="submit">
        <Save size={14} /> Synchronize Preferences
      </Button>
    </form>
  );
}

// 13. Personal Notification preferences (All Members)
function PersonalNotificationSection({ user, onUpdate, role }) {
  const initialPrefs = useMemo(() => {
    // Convert Map or Object to clean keys
    const raw = user?.notificationPrefs;
    const defaults = {
      task_assigned: true,
      task_approved: true,
      meeting_reminder: true,
      client_update: false,
      message_dm: true,
      weekly_report: false,
      deal_closed: true,
      new_comment: true,
      lead_assigned: true,
      lead_mentioned: true
    };
    if (!raw) return defaults;
    
    // Handle Map structure or plain object safely
    const obj = {};
    Object.keys(defaults).forEach((k) => {
      obj[k] = raw instanceof Map ? raw.get(k) : raw[k];
      if (obj[k] === undefined) obj[k] = defaults[k];
    });
    return obj;
  }, [user]);

  const [prefs, setPrefs] = useState(initialPrefs);
  const [permission, setPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  useEffect(() => {
    setPrefs(initialPrefs);
  }, [initialPrefs]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleToggle = (key, val) => {
    setPrefs({ ...prefs, [key]: val });
  };

  const handleSave = () => {
    onUpdate({ notificationPrefs: prefs });
  };

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === 'granted') {
        toast.success('System notifications successfully enabled!');
        sendTestNotification();
      } else if (res === 'denied') {
        toast.error('Notification permission was denied. Please update your browser site settings.');
      }
    } catch {
      toast.error('Failed to request notification permission.');
    }
  };

  const sendTestNotification = async () => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      toast.error('Notifications are not permitted by your browser.');
      return;
    }
    
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification('CRM System Test', {
          body: 'Hello! This is a test Windows toast notification from your CRM.',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'test-notification',
          renotify: true,
          requireInteraction: false
        });
      } else {
        new Notification('CRM System Test', {
          body: 'Hello! This is a test Windows toast notification from your CRM.',
          icon: '/favicon.ico',
          tag: 'test-notification'
        });
      }
      toast.success('Test notification sent!');
    } catch (err) {
      new Notification('CRM System Test', {
        body: 'Hello! This is a test Windows toast notification from your CRM.',
        icon: '/favicon.ico',
        tag: 'test-notification'
      });
      toast.success('Test notification sent via fallback!');
    }
  };

  const allPrefsList = [
    { key: 'task_assigned',    label: 'New Task Assigned',       desc: 'Get notified immediately when a task is assigned to you.' },
    { key: 'task_approved',    label: 'Task Completed',          desc: 'Alert when a task you submitted for review is marked as completed.' },
    { key: 'meeting_reminder', label: '15-Min Meeting Alert',    desc: 'Pre-meeting alerts 15 minutes before a meeting starts.' },
    { key: 'message_dm',       label: 'Channel Messages',        desc: 'Notifications on receiving direct chat thread communications.' },
    { key: 'new_comment',      label: 'Comments & Activity',     desc: 'Get alerts on task feedback or activity notes.' },
    // staff-only below
    { key: 'client_update',    label: 'Client Profile updates',  desc: 'Get updates when client budget, contract or onboarding terms are modified.', staffOnly: true },
    { key: 'deal_closed',      label: 'Closed Deal summary',     desc: 'Admin summary alerts when sales deals are closed won/lost.', staffOnly: true },
    { key: 'weekly_report',    label: 'Weekly Digest summary',   desc: 'Receive Monday performance stats in a summary email.', staffOnly: true },
    { key: 'lead_assigned',    label: 'Lead Reassignments',      desc: 'Get notified immediately when a B2B sales lead is assigned to you.', staffOnly: true },
    { key: 'lead_mentioned',   label: 'Lead Note @Mentions',     desc: 'Alert when other sales reps or admins tag you in internal lead activity streams.', staffOnly: true },
  ];
  const prefsList = role === 'client'
    ? allPrefsList.filter((p) => !p.staffOnly)
    : allPrefsList;

  return (
    <div className="space-y-6">
      <h3 className="text-[16px] font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
        <Bell size={18} className="text-indigo-500" /> Personal Notification Preferences
      </h3>

      {/* OS Notification Status Card */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-550/5 dark:bg-slate-900/30 max-w-xl space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-[13.5px] font-bold text-slate-850 dark:text-slate-200 flex items-center gap-1.5">
              <Smartphone size={16} className="text-indigo-500" /> Windows / Desktop OS Notifications
            </h4>
            <p className="text-[12px] text-slate-500 mt-1">
              To receive Windows-level toast notifications outside the CRM, you must grant permission in your browser.
            </p>
          </div>
          <span className={cn(
            'px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider',
            permission === 'granted' ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400' :
            permission === 'denied' ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400' :
            'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
          )}>
            {permission === 'granted' ? 'Active' : permission === 'denied' ? 'Blocked' : 'Not Configured'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {(permission === 'default' || permission === 'unsupported') && (
            <Button variant="primary" size="sm" onClick={requestPermission} disabled={permission === 'unsupported'}>
              Enable OS Notifications
            </Button>
          )}
          {permission === 'denied' && (
            <div className="text-[12px] text-red-500 flex items-start gap-1 font-semibold">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5 text-red-500 animate-pulse" />
              <span>Permission blocked in Brave/Chrome. Click the lock/settings icon in the URL bar and change Notifications to "Allow".</span>
            </div>
          )}
          {permission === 'granted' && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={sendTestNotification}>
                Send Test OS Notification
              </Button>
              <span className="text-[12px] text-slate-400 flex items-center gap-1">
                <Check size={13} className="text-green-500" /> OS push integration active
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-w-xl">
        {prefsList.map((p) => (
          <Toggle
            key={p.key}
            label={p.label}
            description={p.desc}
            checked={!!prefs[p.key]}
            onChange={(v) => handleToggle(p.key, v)}
          />
        ))}
      </div>

      <div className="mt-2">
        <Button variant="primary" onClick={handleSave}>
          <Save size={14} /> Save Preferences
        </Button>
      </div>
    </div>
  );
}

// 14. Signature & Landing view preferences (All Members)
function SignaturePreferencesSection({ user, onUpdate }) {
  const [landingView, setLandingView] = useState(user?.defaultLandingView || 'dashboard');
  const [signature, setSignature] = useState(user?.personalSignature || '');

  const handleSave = () => {
    onUpdate({
      personalSignature: signature,
      defaultLandingView: landingView
    });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-[16px] font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
        <PenTool size={18} className="text-indigo-500" /> Personal Signature & View Preferences
      </h3>

      <div className="space-y-4 max-w-xl">
        <div>
          <label className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Default Landing View</label>
          <p className="text-[12px] text-slate-450 mb-2">Choose which interface opens directly upon logging into the BizzBuzz CRM.</p>
          <select className="form-input text-[13.5px] py-2" value={landingView} onChange={(e) => setLandingView(e.target.value)}>
            <option value="dashboard">Analytics Dashboard Summary</option>
            <option value="tasks">Tasks Board Kanban Grid</option>
            <option value="clients">Clients & Dynamic Projects Directory</option>
          </select>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-850">
          <label className="block text-[13.5px] font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Professional Email Signature</label>
          <p className="text-[12.5px] text-slate-450 mb-2">This signature will automatically append to all client outreach emails sent from the CRM.</p>
          <textarea 
            rows={5} className="form-input text-[13px] py-2 resize-none font-mono" 
            value={signature} onChange={(e) => setSignature(e.target.value)} 
            placeholder={`Regards,\n${user?.name || 'Representative'}\nBizzBuzz Creations`}
          />
        </div>
      </div>

      <Button variant="primary" onClick={handleSave}>
        <Save size={14} /> Update Signature & Layout
      </Button>
    </div>
  );
}


// ───────────────────────────────────────────────────────────────────
// ── Main Settings Page Dashboard
// ───────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { 
    authUser, users, tasks, todos, clients, systemSettings, 
    updateSystemSettings, inviteUser, updateProfile 
  } = useAppStore(
    useShallow((s) => ({
      authUser:             s.authUser,
      users:                s.users,
      tasks:                s.tasks,
      todos:                s.todos,
      clients:              s.clients,
      systemSettings:       s.systemSettings,
      updateSystemSettings: s.updateSystemSettings,
      inviteUser:           s.inviteUser,
      updateProfile:        s.updateProfile
    }))
  );

  const role = authUser?.role;
  const isClient = role === 'client';
  const isManager = canManage(role);
  const isAdmin = canAdmin(role);

  // Group tabs dynamically
  const tabsList = useMemo(() => {
    const list = [];

    if (isClient) {
      // Clients only see profile, notifications, and password change
      list.push({ group: 'My Account', items: [
        { id: 'profile',       label: 'My Profile',   icon: User },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security',      label: 'Change Password', icon: Lock },
      ]});
      return list;
    }

    // Tier 3: Personal Settings (All Members)
    list.push({ group: 'Personal Setup', items: [
      { id: 'profile',       label: 'My Profile',      icon: User },
      { id: 'email_sync',    label: 'Email & Sync',    icon: Mail },
      { id: 'notifications', label: 'My Alerts',       icon: Bell },
      { id: 'signature',     label: 'Signature',       icon: PenTool },
      { id: 'security',      label: 'Security & Pwd',  icon: Lock },
      { id: 'worklog',       label: 'Hours Log',       icon: Clock },
      { id: 'lead_import',   label: 'Lead Importer',   icon: Database }
    ]});

    // Tier 2: Managerial Settings (Admins & Managers)
    if (isManager) {
      list.push({ group: 'Operations', items: [
        { id: 'teams',            label: 'Users & Teams',   icon: Users },
        { id: 'workspace',        label: 'Workspace Lists', icon: Settings },
        { id: 'assignment_rules', label: 'Lead Routing',    icon: Sliders },
        { id: 'templates',        label: 'Communication',   icon: FileText },
        { id: 'integrations',     label: 'Integrations',    icon: Zap },
        { id: 'data',             label: 'Data Controls',   icon: Database }
      ]});
    }

    // Tier 1: System Settings (Admins Only)
    if (isAdmin) {
      list.push({ group: 'Global Admin', items: [
        { id: 'company',        label: 'Company Profile', icon: Globe },
        { id: 'billing',        label: 'CRM Subscription',icon: Rocket },
        { id: 'security_config',label: 'Auth Controls',   icon: Shield },
        { id: 'pipelines',      label: 'Sales Pipelines', icon: Sliders },
        { id: 'custom_fields',  label: 'Custom Fields',   icon: Code },
        { id: 'services',       label: 'Services Dir',    icon: Layers }
      ]});
    }

    return list;
  }, [isAdmin, isManager]);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'profile');

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Personal Profile updates
  const handleUpdateProfile = async (body) => {
    try {
      const res = await updateProfile(body);
      if (res?.success) toast.success('Profile updated!');
    } catch {}
  };

  // Global settings updates
  const handleUpdateSystemSettings = async (body) => {
    try {
      await updateSystemSettings(body);
    } catch {}
  };

  // Export handlers
  const today = new Date().toISOString().split('T')[0];

  const handleExportTasks = () => {
    const rows = [
      ['Title','Assigned To','Status','Priority','Due Date','Created','Type'],
      ...tasks.map((t) => [t.title, String(t.assignedTo), t.status, t.priority, t.dueDate||'', t.createdAt||'', t.type]),
    ];
    downloadCSV(rows, `tasks-${today}.csv`);
    toast.success('Tasks exported!');
  };

  const handleExportTodos = () => {
    const rows = [
      ['Title','User ID','Status','Priority','ETA','Created'],
      ...todos.map((t) => [t.title, String(t.userId), t.status, t.priority, t.eta||'', t.createdAt||'']),
    ];
    downloadCSV(rows, `todos-${today}.csv`);
    toast.success('Todos exported!');
  };

  const handleExportClients = () => {
    const rows = [
      ['Name','Contact','Email','Phone','Industry','Status','Payment','Budget'],
      ...clients.map((c) => [c.name, c.contact, c.email, c.phone, c.industry, c.status, c.paymentStatus, c.budget]),
    ];
    downloadCSV(rows, `clients-${today}.csv`);
    toast.success('Clients exported!');
  };

  const handleFullBackup = () => {
    downloadJSON({ tasks, todos, clients, systemSettings, exported: today }, `agencyos-backup-${today}.json`);
    toast.success('Full database backup downloaded!');
  };

  return (
    <Page>
      <div className="mb-6">
        <h1 className="page-title">{isClient ? 'Account Settings' : 'General Settings Dashboard'}</h1>
        <p className="page-sub">{isClient ? 'Manage your profile, notifications, and portal password' : 'Configure dynamic workspace setups, lead distributions, templates, and agent sync accounts'}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ── Left Navigation Panels ── */}
        <div className="w-full lg:w-60 flex-shrink-0 space-y-4">
          {tabsList.map((grp) => (
            <div key={grp.group} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-2 shadow-card">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-3 py-1.5">{grp.group}</p>
              {grp.items.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all text-left mb-0.5 last:mb-0',
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm border-l-2 border-indigo-500'
                        : 'text-slate-600 dark:text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                    )}
                  >
                    <tab.icon size={15} className={cn('flex-shrink-0', isActive ? 'text-indigo-500' : 'text-slate-400')} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* ── Right Content Dashboard Panel ── */}
        <div className="flex-1 w-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-6 md:p-8 shadow-card min-h-[500px]">
          {/* Tier 3: Personal Settings */}
          {activeTab === 'profile' && (
            <PersonalProfileSection user={authUser} onUpdate={handleUpdateProfile} />
          )}
          {activeTab === 'email_sync' && (
            <EmailCalendarSyncSection user={authUser} onUpdate={handleUpdateProfile} />
          )}
          {activeTab === 'notifications' && (
            <PersonalNotificationSection user={authUser} onUpdate={handleUpdateProfile} role={role} />
          )}
          {activeTab === 'signature' && (
            <SignaturePreferencesSection user={authUser} onUpdate={handleUpdateProfile} />
          )}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <h3 className="text-[16px] font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
                <Lock size={18} className="text-indigo-500" /> Account Security Controls
              </h3>
              <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-[13px] text-slate-500 flex gap-2">
                <Info size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                <span>To change your password, fill in your current credentials below to verify your session ownership.</span>
              </div>
              <SecuritySection />
            </div>
          )}
          {activeTab === 'worklog' && (
            <div>
              <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 flex gap-2">
                <Clock size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                <span className="text-[13px] text-slate-500">Track and monitor your daily work hours log and breaks history recorded by the active session timer.</span>
              </div>
              <WorkLogSection authUser={authUser} users={users} />
            </div>
          )}
          {activeTab === 'lead_import' && (
            <LeadImporterSection />
          )}

          {/* Tier 2: Managerial Settings */}
          {isManager && activeTab === 'teams' && (
            <TeamsManagementSection 
              settings={systemSettings} onSave={handleUpdateSystemSettings} 
              users={users} onInvite={inviteUser} 
            />
          )}
          {isManager && activeTab === 'assignment_rules' && (
            <AssignmentRulesSection settings={systemSettings} onSave={handleUpdateSystemSettings} />
          )}
          {isManager && activeTab === 'templates' && (
            <TemplatesSection settings={systemSettings} onSave={handleUpdateSystemSettings} />
          )}
          {isManager && activeTab === 'integrations' && (
            <IntegrationsSection settings={systemSettings} onSave={handleUpdateSystemSettings} />
          )}
          {isManager && activeTab === 'data' && (
            <DataControlSection 
              settings={systemSettings} onSave={handleUpdateSystemSettings}
              onExportTasks={handleExportTasks} onExportTodos={handleExportTodos} 
              onExportClients={handleExportClients} onFullBackup={handleFullBackup} 
            />
          )}

          {/* Tier 1: Admin Only Settings */}
          {isAdmin && activeTab === 'company' && (
            <CompanyProfileSection settings={systemSettings} onSave={handleUpdateSystemSettings} />
          )}
          {isAdmin && activeTab === 'billing' && (
            <BillingSubscriptionSection settings={systemSettings} onSave={handleUpdateSystemSettings} />
          )}
          {isAdmin && activeTab === 'security_config' && (
            <SecurityConfigSection settings={systemSettings} onSave={handleUpdateSystemSettings} />
          )}
          {isAdmin && activeTab === 'pipelines' && (
            <PipelinesStagesSection settings={systemSettings} onSave={handleUpdateSystemSettings} />
          )}
          {isAdmin && activeTab === 'custom_fields' && (
            <CustomFieldsSection settings={systemSettings} onSave={handleUpdateSystemSettings} />
          )}
          {isAdmin && activeTab === 'services' && (
            <ServicesSection />
          )}
          {isManager && activeTab === 'workspace' && (
            <WorkspaceSection settings={systemSettings} onSave={handleUpdateSystemSettings} />
          )}
        </div>
      </div>
    </Page>
  );
}

// ───────────────────────────────────────────────────────────────────
// ── Keep legacy layout / subcomponents compatible ──────────────────
// ───────────────────────────────────────────────────────────────────

function SecuritySection() {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { currentPwd: '', newPwd: '', confirmPwd: '' },
  });
  const changePassword = useAppStore((s) => s.changePassword);

  const onSubmit = async (data) => {
    if (data.newPwd !== data.confirmPwd) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await changePassword(data.currentPwd, data.newPwd);
      if (res?.success) {
        reset();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      <div>
        <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-350 mb-1">Current Password</label>
        <input type="password" required className="form-input text-[13px] py-1.5" {...register('currentPwd')} />
      </div>
      <div>
        <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-350 mb-1">New Password</label>
        <input type="password" required minLength={6} className="form-input text-[13px] py-1.5" {...register('newPwd')} placeholder="Min 6 characters" />
      </div>
      <div>
        <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-350 mb-1">Confirm New Password</label>
        <input type="password" required className="form-input text-[13px] py-1.5" {...register('confirmPwd')} />
      </div>
      <Button variant="primary" type="submit" disabled={loading}>
        {loading ? <RefreshCw size={14} className="animate-spin mr-1" /> : <Lock size={14} className="mr-1" />}
        {loading ? 'Updating...' : 'Update Password'}
      </Button>
    </form>
  );
}

function WorkLogSection({ authUser, users }) {
  const isManager   = canManage(authUser?.role);
  const [filterUser, setFilterUser] = useState('all');
  const fetchWorkLog = useAppStore((s) => s.fetchWorkLog);
  const [dbLogs, setDbLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchWorkLog();
        if (active) setDbLogs(data || []);
      } catch (err) {
        console.error('Failed to fetch work logs from backend', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [fetchWorkLog]);

  const allRows = useMemo(() => {
    const rows = [];
    dbLogs.forEach((log) => {
      const u = users.find((usr) => sameId(usr, log.userId));
      if (!u) return;
      if (!isManager && !sameId(u, authUser)) return;
      rows.push({
        user:          u,
        date:          log.date,
        workSeconds:   log.workSeconds || 0,
        breaks:        log.breaks || [],
        isToday:       log.date === new Date().toISOString().split('T')[0],
        targetSeconds: log.targetSeconds || (8 * 3600),
      });
    });
    return rows.sort((a, b) => {
      if (a.isToday && !b.isToday) return -1;
      if (!a.isToday && b.isToday) return 1;
      return (b.date || '').localeCompare(a.date || '');
    });
  }, [dbLogs, users, authUser, isManager]);

  const filtered = useMemo(() => {
    if (!isManager || filterUser === 'all') return allRows;
    return allRows.filter((r) => getId(r.user) === filterUser);
  }, [allRows, filterUser, isManager]);

  const breakTotal = (breaks, type) => {
    if (!breaks?.length) return 0;
    return breaks.filter((b) => b.type === type).reduce((a, b) => a + (b.actual || b.planned || 0), 0);
  };

  return (
    <div>
      {isManager && (
        <div className="flex items-center gap-2 text-[13px] text-slate-500 mb-4 justify-end">
          <span className="font-semibold">Viewing Logs:</span>
          <select className="form-input w-[160px] py-1.5 text-[13px]" value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
            <option value="all">All Members</option>
            {users.map((u) => (
              <option key={getId(u)} value={getId(u)}>{u.name}</option>
            ))}
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <Clock size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-[14.5px] font-semibold">No work log entries found</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-850 rounded-xl">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                {['Member','Date','Time Worked','Lunch Used','Tea Used','Custom Break','Status'].map((h) => (
                  <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-3 px-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const isActive   = sameId(row.user, authUser) && row.isToday;
                const target     = row.targetSeconds || (8 * 3600);
                const pct        = Math.min(100, (row.workSeconds / target) * 100);
                const lunchSecs  = breakTotal(row.breaks, 'lunch');
                const teaSecs    = breakTotal(row.breaks, 'tea');
                const customSecs = breakTotal(row.breaks, 'custom');

                return (
                  <tr key={i} className="border-b border-slate-200 dark:border-slate-800/60 last:border-b-0 hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full text-white font-bold flex items-center justify-center text-[12px]" style={{ background: row.user.color || '#6366f1' }}>
                          {row.user.name?.[0]}
                        </div>
                        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">{row.user.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[13px] text-slate-650 dark:text-slate-400">{fmtDate(row.date)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444' }} />
                        </div>
                        <span className="font-mono text-[13px] font-bold text-slate-800 dark:text-slate-200">{fmtTimer(row.workSeconds)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[13px] font-mono text-slate-550 dark:text-slate-450">{fmtTimer(lunchSecs)}</td>
                    <td className="py-3 px-4 text-[13px] font-mono text-slate-550 dark:text-slate-450">{fmtTimer(teaSecs)}</td>
                    <td className="py-3 px-4 text-[13px] font-mono text-slate-550 dark:text-slate-450">{fmtTimer(customSecs)}</td>
                    <td className="py-3 px-4">
                      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold', isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-450')}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AddServiceModal({ onClose, onSave }) {
  const [name, setName]       = useState('');
  const [desc, setDesc]       = useState('');
  const [category, setCategory] = useState('');
  const [color, setColor]     = useState('#6366f1');
  const [icon, setIcon]       = useState('⚡');
  const [saving, setSaving]   = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Service name is required'); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: desc.trim(), category: category.trim() || 'General', color, icon });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create service');
    } finally {
      setSaving(false);
    }
  };

  const SERVICE_ICON_MAP = {
    '⚡': Zap, '🎨': Palette, '📱': Smartphone, '🌐': Globe, '📊': BarChart3, 
    '✍️': PenTool, '🎬': Clapperboard, '📸': Camera, '🔧': Wrench, '💡': Lightbulb, 
    '🛡️': Shield, '🚀': Rocket
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-[16px] font-bold text-slate-900 dark:text-white">Add New Service</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-350 mb-1">Name *</label>
            <input className="form-input text-[13.5px] py-1.5" placeholder="e.g. Social Media Management" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-350 mb-1">Description</label>
            <textarea className="form-input text-[13.5px] py-1.5 resize-none" rows={2} placeholder="Brief description..." value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-350 mb-1">Category</label>
            <input className="form-input text-[13.5px] py-1.5" placeholder="e.g. Marketing, Design" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-350 mb-1">Icon Preset</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_ICONS.map((ic) => (
                <button
                  key={ic} type="button" onClick={() => setIcon(ic)}
                  className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-all border', icon === ic ? 'bg-indigo-50 border-indigo-400 text-indigo-650' : 'bg-slate-50 dark:bg-slate-900/40 border-transparent hover:border-slate-200')}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-350 mb-1">Theme Accent Color</label>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c} type="button" onClick={() => setColor(c)}
                  className={cn('w-6 h-6 rounded-full border transition-all', color === c ? 'border-slate-800 scale-110' : 'border-transparent')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Add Service'}</Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Workspace Lists Section
// ─────────────────────────────────────────────────────────────
function TagList({ items, onAdd, onRemove, placeholder, isAdmin }) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const val = input.trim();
    if (!val || items.includes(val)) { setInput(''); return; }
    onAdd(val);
    setInput('');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3 min-h-[36px]">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40"
          >
            {item}
            {isAdmin && (
              <button
                onClick={() => onRemove(item)}
                className="text-indigo-400 hover:text-red-500 transition-colors ml-0.5"
              >
                <X size={11} />
              </button>
            )}
          </span>
        ))}
        {items.length === 0 && (
          <span className="text-[12.5px] text-slate-400 italic">No items added yet</span>
        )}
      </div>
      {isAdmin && (
        <div className="flex gap-2">
          <input
            className="form-input text-[13.5px] py-2 flex-1"
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-all flex items-center gap-1.5"
          >
            <Plus size={13} /> Add
          </button>
        </div>
      )}
    </div>
  );
}

function WorkspaceSection({ settings, onSave }) {
  const authUser = useAppStore((s) => s.authUser);
  const isAdmin  = authUser?.role === 'admin';
  const [saving, setSaving] = useState(null); // which field is saving

  const departments = settings?.departments || [];
  const positions   = settings?.positions   || [];
  const industries  = settings?.industries  || [];

  const handleAdd = async (field, value) => {
    setSaving(field);
    try {
      await onSave({ [field]: [...(settings?.[field] || []), value] });
    } finally { setSaving(null); }
  };

  const handleRemove = async (field, value) => {
    setSaving(field);
    try {
      await onSave({ [field]: (settings?.[field] || []).filter((v) => v !== value) });
    } finally { setSaving(null); }
  };

  const lists = [
    {
      key:         'departments',
      label:       'Departments',
      desc:        'Used when assigning team members to departments.',
      items:       departments,
      placeholder: 'e.g. Design',
    },
    {
      key:         'positions',
      label:       'Job Positions',
      desc:        'Available job titles when creating or editing team members.',
      items:       positions,
      placeholder: 'e.g. Motion Designer',
    },
    {
      key:         'industries',
      label:       'Industries',
      desc:        'Industry options available when adding clients.',
      items:       industries,
      placeholder: 'e.g. E-commerce',
    },
  ];

  return (
    <div>
      <div className="pb-4 border-b border-slate-200 dark:border-slate-700 mb-6">
        <h2 className="text-[18px] font-bold text-slate-900 dark:text-white">Workspace Lists</h2>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
          Manage the dropdown options used across the CRM — departments, job positions, and industries.
        </p>
      </div>

      <div className="space-y-8">
        {lists.map(({ key, label, desc, items, placeholder }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <h3 className="text-[14px] font-semibold text-slate-800 dark:text-slate-200">{label}</h3>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">{desc}</p>
              </div>
              {saving === key && (
                <RefreshCw size={13} className="animate-spin text-indigo-400" />
              )}
            </div>
            <TagList
              items={items}
              onAdd={(v) => handleAdd(key, v)}
              onRemove={(v) => handleRemove(key, v)}
              placeholder={placeholder}
              isAdmin={isAdmin}
            />
          </div>
        ))}
      </div>

      {!isAdmin && (
        <div className="mt-6 flex items-start gap-2 px-3.5 py-3 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 rounded-xl text-[12.5px] text-amber-700 dark:text-amber-300">
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          <span>You can view these lists. Only admins can add or remove items.</span>
        </div>
      )}
    </div>
  );
}

function ServicesSection() {
  const { services, addService, deleteService, authUser } = useAppStore(
    useShallow((s) => ({ services: s.services, addService: s.addService, deleteService: s.deleteService, authUser: s.authUser }))
  );
  const isAdmin = authUser?.role === 'admin';
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteService(id);
      toast.success('Service removed');
    } catch {
      toast.error('Failed to delete service');
    } finally {
      setDeletingId(null);
    }
  };

  const grouped = services.reduce((acc, sv) => {
    const cat = sv.category || 'General';
    (acc[cat] = acc[cat] || []).push(sv);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700/60 mb-5">
        <div>
          <h4 className="text-[15px] font-bold text-slate-800 dark:text-slate-200">Corporate Service Catalog</h4>
        </div>
        {isAdmin && (
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
            <Plus size={13} /> Add Service
          </Button>
        )}
      </div>

      {services.length === 0 ? (
        <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <Layers size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-[14px] font-semibold">No services configured yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{cat}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.map((sv) => (
                  <div key={sv._id} className="relative p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[18px]" style={{ background: sv.color + '15', color: sv.color }}>
                        {sv.icon || '⚡'}
                      </div>
                      <div>
                        <p className="text-[13.5px] font-bold text-slate-800 dark:text-slate-200">{sv.name}</p>
                        {sv.description && <p className="text-[12px] text-slate-550 dark:text-slate-400 mt-0.5">{sv.description}</p>}
                      </div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleDelete(sv._id)} disabled={deletingId === sv._id} className="text-slate-400 hover:text-red-500 p-1">
                        {deletingId === sv._id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddServiceModal onClose={() => setShowModal(false)} onSave={async (body) => { await addService(body); toast.success('Service added!'); }} />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// ── Lead Importer Subcomponent (Spreadsheet Data Clean Flow)
// ───────────────────────────────────────────────────────────────────
function LeadImporterSection() {
  const navigate = useNavigate();
  const bulkCreateLeads = useAppStore((s) => s.bulkCreateLeads);

  const [step, setStep] = useState(1); // 1: Ingest/Upload, 2: Mapping, 3: Spreadsheet/Editing
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvLines, setCsvLines] = useState([]);
  
  // Mapping state: key is target B2B field, value is index of matched CSV column
  const [mapping, setMapping] = useState({
    companyName: '',
    contactPerson: '',
    dealValue: '',
    email: '',
    phone: '',
    website: ''
  });

  // Table editor data
  const [importRows, setImportRows] = useState([]);

  // File states
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // Download simple B2B CSV template
  const handleDownloadTemplate = () => {
    const templateRows = [
      ['Company Name', 'Contact Person', 'Deal Value', 'Email', 'Phone', 'Website'],
      ['Acme Corp', 'Alice Smith', '5000', 'alice@acme.com', '123-456-7890', 'acme.com'],
      ['Apex Solutions', 'Bob Johnson', '₹12,000', 'bob@apex.co', '9876543210', 'apex.co'],
      ['Global Partners Ltd', '', 'invalid-value', 'invalid-email', '555', ''], // row with errors / warnings
    ];
    downloadCSV(templateRows, 'lead_import_template.csv');
    toast.success('B2B Template CSV downloaded successfully!');
  };

  // Parse CSV file content
  const processCSVFile = (file) => {
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (rawLines.length <= 1) {
          toast.error('The selected CSV file has no records');
          return;
        }

        // Parse headers from the first line
        const parsedHeaders = rawLines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        setCsvHeaders(parsedHeaders);

        // Store CSV rows parsed by split commas
        const linesData = [];
        for (let i = 1; i < rawLines.length; i++) {
          const rowData = rawLines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
          linesData.push(rowData);
        }
        setCsvLines(linesData);

        // Pre-fill mapping automatically by scanning header names
        const initialMapping = {
          companyName: '',
          contactPerson: '',
          dealValue: '',
          email: '',
          phone: '',
          website: ''
        };

        parsedHeaders.forEach((h, idx) => {
          const l = h.toLowerCase();
          if (l.includes('company') || l.includes('title') || l.includes('org') || l.includes('firm')) {
            initialMapping.companyName = idx;
          } else if (l.includes('contact') || l.includes('person') || l.includes('name')) {
            initialMapping.contactPerson = idx;
          } else if (l.includes('value') || l.includes('deal') || l.includes('size') || l.includes('budget') || l.includes('worth')) {
            initialMapping.dealValue = idx;
          } else if (l.includes('email') || l.includes('mail')) {
            initialMapping.email = idx;
          } else if (l.includes('phone') || l.includes('mobile') || l.includes('cell') || l.includes('contact no')) {
            initialMapping.phone = idx;
          } else if (l.includes('website') || l.includes('site') || l.includes('link') || l.includes('web')) {
            initialMapping.website = idx;
          }
        });

        setMapping(initialMapping);
        setStep(2); // Go to step 2 (Mapping)
        toast.success('CSV uploaded successfully! Please verify column mappings.');
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse CSV file. Ensure it is comma-separated.');
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    processCSVFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    processCSVFile(file);
  };

  // Convert raw CSV lines to Lead objects based on mappings
  const handleConfirmMapping = () => {
    if (mapping.companyName === '') {
      toast.error('You must map the Company Name field (Required)');
      return;
    }

    const rows = csvLines.map((cols) => {
      const companyName = cols[mapping.companyName] || '';
      const contactPerson = mapping.contactPerson !== '' ? cols[mapping.contactPerson] || '' : '';
      const dealValue = mapping.dealValue !== '' ? cols[mapping.dealValue] || '' : '';
      const email = mapping.email !== '' ? cols[mapping.email] || '' : '';
      const phone = mapping.phone !== '' ? cols[mapping.phone] || '' : '';
      const website = mapping.website !== '' ? cols[mapping.website] || '' : '';

      return {
        companyName,
        contactPerson,
        dealValue,
        email,
        phone,
        website
      };
    });

    setImportRows(rows);
    setStep(3); // Go to step 3 (Spreadsheet validation)
    toast.success('Leads structured! Please review and fix any validation warnings.');
  };

  // Inline row validation
  const validateRow = (row) => {
    const errors = [];
    const warnings = [];

    if (!row.companyName || !row.companyName.trim()) {
      errors.push('Company name is required');
    }

    if (!row.contactPerson || !row.contactPerson.trim() || row.contactPerson.trim() === 'Undecided') {
      warnings.push('Contact person is blank (will default to "Undecided")');
    }

    const cleanedVal = String(row.dealValue).replace(/[^0-9.]/g, '');
    const numVal = Number(cleanedVal);
    if (isNaN(numVal) || numVal < 0 || String(row.dealValue).trim() === '') {
      warnings.push('Deal value is invalid or negative (will default to 0)');
    } else if (cleanedVal !== String(row.dealValue).trim()) {
      warnings.push('Value contains non-numeric formatting (will be cleaned)');
    }

    if (row.email && row.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(row.email.trim())) {
        warnings.push('Email address format is invalid');
      }
    }

    if (row.phone && row.phone.trim()) {
      const digits = row.phone.replace(/[^0-9]/g, '');
      if (digits.length < 6) {
        warnings.push('Phone number is too short');
      }
    }

    let status = 'clean';
    if (errors.length > 0) status = 'error';
    else if (warnings.length > 0) status = 'warning';

    return { status, errors, warnings };
  };

  // Live evaluated data rows with validations added on top
  const evaluatedRows = useMemo(() => {
    return importRows.map(row => ({
      data: row,
      val: validateRow(row)
    }));
  }, [importRows]);

  const stats = useMemo(() => {
    let clean = 0;
    let warning = 0;
    let error = 0;

    evaluatedRows.forEach(r => {
      if (r.val.status === 'clean') clean++;
      else if (r.val.status === 'warning') warning++;
      else if (r.val.status === 'error') error++;
    });

    return { clean, warning, error, total: evaluatedRows.length };
  }, [evaluatedRows]);

  // Edit in-place
  const handleCellChange = (rowIndex, field, value) => {
    const updated = [...importRows];
    updated[rowIndex] = { ...updated[rowIndex], [field]: value };
    setImportRows(updated);
  };

  // Delete row from import
  const handleDeleteRow = (rowIndex) => {
    setImportRows(importRows.filter((_, i) => i !== rowIndex));
  };

  // Auto-resolve warnings in bulk
  const handleAutoResolve = () => {
    const resolved = importRows.map(row => {
      const updated = { ...row };

      // 1. Contact Person fallback
      if (!updated.contactPerson || !updated.contactPerson.trim()) {
        updated.contactPerson = 'Undecided';
      }

      // 2. Deal Value numeric extraction
      const cleanVal = String(updated.dealValue).replace(/[^0-9.]/g, '');
      const parsedVal = Number(cleanVal);
      updated.dealValue = isNaN(parsedVal) || cleanVal === '' ? 0 : parsedVal;

      // 3. Email & Phone trim
      if (updated.email) updated.email = updated.email.trim();
      if (updated.phone) updated.phone = updated.phone.trim();

      return updated;
    });

    setImportRows(resolved);
    toast.success('Auto-resolved and sanitized warnings in-bulk!');
  };

  // Submit complete ingestion to database
  const handleCompleteImport = async () => {
    if (stats.error > 0) {
      toast.error('Please fix all Company Name errors before completing the ingestion.');
      return;
    }

    // Sanitize values for the final payload
    const finalLeads = importRows.map(row => {
      const cleanVal = String(row.dealValue).replace(/[^0-9.]/g, '');
      const parsedVal = Number(cleanVal);

      return {
        companyName: row.companyName.trim(),
        contactPerson: row.contactPerson.trim() || 'Undecided',
        dealValue: isNaN(parsedVal) || cleanVal === '' ? 0 : parsedVal,
        email: row.email ? row.email.trim() : '',
        phone: row.phone ? row.phone.trim() : '',
        website: row.website ? row.website.trim() : '',
        status: 'New Lead',
        source: 'Import'
      };
    });

    try {
      await bulkCreateLeads(finalLeads);
      navigate('/leads');
    } catch {}
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Tab Title */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700/60">
        <h3 className="text-[16px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Database size={18} className="text-indigo-500" /> B2B Leads Ingestion Importer
        </h3>
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="flex items-center gap-1 text-[12px] text-indigo-600 border-indigo-200 dark:text-indigo-400 dark:border-indigo-950">
          <Download size={13} />
          <span>Download Template CSV</span>
        </Button>
      </div>

      {/* Progress timeline */}
      <div className="flex items-center justify-center gap-2 text-[12.5px] font-bold py-2 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-800">
        <span className={cn("px-3 py-1 rounded-full transition-all", step >= 1 ? "bg-indigo-500 text-white" : "text-slate-450")}>1. Ingest File</span>
        <span className="text-slate-400">➔</span>
        <span className={cn("px-3 py-1 rounded-full transition-all", step >= 2 ? "bg-indigo-500 text-white" : "text-slate-450")}>2. Column Mapping</span>
        <span className="text-slate-400">➔</span>
        <span className={cn("px-3 py-1 rounded-full transition-all", step >= 3 ? "bg-indigo-500 text-white" : "text-slate-450")}>3. Interactive Clean-up</span>
      </div>

      {/* STEP 1: Upload Dropzone */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-[13px] text-slate-550 flex gap-2.5">
            <Info size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-700 dark:text-slate-350 mb-0.5">Prepare clean B2B sheets for error-free importing</p>
              <p>Drag in your CSV file. Standard comma layouts work immediately. We automatically map columns for company, contact representatives, and deal value sizes, let you edit records inline, and resolve warnings before committing to the catalog.</p>
            </div>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-3xl p-12 text-center relative cursor-pointer transition-all min-h-[220px] flex flex-col justify-center items-center",
              dragOver 
                ? "border-indigo-500 bg-indigo-500/[0.04]" 
                : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/10"
            )}
          >
            <input
              type="file" accept=".csv"
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              onChange={handleFileChange}
            />
            <Database size={40} className="text-indigo-500 mb-3.5 opacity-80" />
            <p className="text-[13.5px] font-bold text-slate-800 dark:text-slate-200">
              Drag your sales CSV sheet here or <span className="text-indigo-650 dark:text-indigo-400 underline">browse computer</span>
            </p>
            <p className="text-[11.5px] text-slate-400 mt-1">Supports standard comma-separated sheets up to 500 records</p>
          </div>
        </div>
      )}

      {/* STEP 2: Mapping Header columns */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-indigo-500/[0.02] border border-indigo-500/10 text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-400 space-y-1">
            <p className="font-bold text-indigo-650 dark:text-indigo-400 flex items-center gap-1.5">
              <ArrowUpRight size={15} /> Header Column Alignment:
            </p>
            <p>Align the column headers from your file <strong className="text-slate-700 dark:text-slate-300">({fileName})</strong> to the CRM B2B Lead fields. We pre-mapped fields that matched closely.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden text-[13px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-400 uppercase tracking-widest text-[10.5px]">
                  <th className="px-5 py-3">Lead Database Target Field</th>
                  <th className="px-5 py-3">CSV Header Match Selection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-105 dark:divide-slate-800 font-semibold text-slate-800 dark:text-slate-200">
                {[
                  { key: 'companyName', label: 'Company Name (Required)', required: true },
                  { key: 'contactPerson', label: 'Contact Person', required: false },
                  { key: 'dealValue', label: 'Deal Value (Budget)', required: false },
                  { key: 'email', label: 'Email Address', required: false },
                  { key: 'phone', label: 'Phone Number', required: false },
                  { key: 'website', label: 'Website Link', required: false }
                ].map((f) => (
                  <tr key={f.key}>
                    <td className="px-5 py-4">{f.label}</td>
                    <td className="px-5 py-4">
                      <select
                        className="form-input text-[13px] py-1.5 w-64 font-sans font-medium"
                        value={mapping[f.key]}
                        onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value === '' ? '' : Number(e.target.value) })}
                      >
                        <option value="">-- Do Not Import --</option>
                        {csvHeaders.map((h, i) => (
                          <option key={i} value={i}>Column #{i + 1}: "{h}"</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 text-[13px]">
            <Button variant="outline" onClick={() => setStep(1)}>Go Back</Button>
            <Button variant="primary" onClick={handleConfirmMapping} disabled={mapping.companyName === ''}>
              Align Columns & Structure Data
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Spreadsheet interactive review and validator */}
      {step === 3 && (
        <div className="space-y-5 animate-fadeIn">
          {/* Summary dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-250 dark:border-slate-800 text-[12px] font-semibold text-slate-450">
              <span>Total rows parsed</span>
              <p className="text-[20px] font-bold text-slate-800 dark:text-white mt-1">{stats.total}</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[12px] font-semibold text-emerald-600 dark:text-emerald-450">
              <span>Clean rows (🟢 Ready)</span>
              <p className="text-[20px] font-bold mt-1">{stats.clean}</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[12px] font-semibold text-amber-600 dark:text-amber-450">
              <span>Warnings (🟡 Flagged)</span>
              <p className="text-[20px] font-bold mt-1">{stats.warning}</p>
            </div>
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] font-semibold text-red-500">
              <span>Errors (🔴 Critical)</span>
              <p className="text-[20px] font-bold mt-1">{stats.error}</p>
            </div>
          </div>

          {/* Interactive controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12.5px] p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">Interactive Spreadsheet Editor</p>
              <p className="text-[11.5px] text-slate-400">Click on any cell to edit details inline. Clear all errors before completing.</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleAutoResolve} className="text-amber-605 border-amber-200 hover:bg-amber-50 dark:border-amber-950 dark:hover:bg-amber-950/20">
                ⚡ Auto-Resolve Warnings
              </Button>
              <Button size="sm" variant="outline" onClick={() => setStep(2)}>
                Change Mapping
              </Button>
            </div>
          </div>

          {/* Interactive Spreadsheet Grid */}
          <div className="border border-slate-200 dark:border-slate-850 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-md">
            <div className="overflow-x-auto max-h-[440px]">
              <table className="w-full text-left border-collapse text-[12.5px] font-sans">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-855 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-400 uppercase tracking-widest text-[10px]">
                    <th className="px-4 py-3 text-center w-16">Status</th>
                    <th className="px-4 py-3 min-w-[90px]">Lead ID</th>
                    <th className="px-4 py-3 min-w-[140px]">Company Name *</th>
                    <th className="px-4 py-3 min-w-[120px]">Contact Person</th>
                    <th className="px-4 py-3 min-w-[100px]">Deal Value (₹)</th>
                    <th className="px-4 py-3 min-w-[150px]">Email</th>
                    <th className="px-4 py-3 min-w-[110px]">Phone</th>
                    <th className="px-4 py-3 min-w-[120px]">Website</th>
                    <th className="px-4 py-3 text-center w-12">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
                  {evaluatedRows.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-4 py-8 text-center text-slate-450 italic">
                        No records loaded in import grid list.
                      </td>
                    </tr>
                  ) : (
                    evaluatedRows.map((row, idx) => {
                      const isErr = row.val.status === 'error';
                      const isWarn = row.val.status === 'warning';
                      const hasAlert = isErr || isWarn;

                      return (
                        <tr key={idx} className={cn(
                          "transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/10",
                          isErr ? "bg-red-500/[0.02]" : isWarn ? "bg-amber-500/[0.01]" : ""
                        )}>
                          <td className="px-4 py-2.5 text-center">
                            <span 
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded-full cursor-help",
                                isErr 
                                  ? "bg-red-500/15 text-red-500" 
                                  : isWarn 
                                    ? "bg-amber-500/15 text-amber-500" 
                                    : "bg-emerald-500/15 text-emerald-500"
                              )}
                              title={hasAlert ? [...row.val.errors, ...row.val.warnings].join(' | ') : 'Ready to import!'}
                            >
                              {isErr ? '🔴 Err' : isWarn ? '🟡 Warn' : '🟢 Ready'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11.5px] font-bold text-slate-450 dark:text-slate-500 italic select-none">
                            <span>[Auto]</span>
                          </td>
                          <td className="px-2 py-1">
                            <input
                              className={cn(
                                "bg-transparent border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-2 py-1 w-full outline-none transition-all",
                                isErr && !row.data.companyName?.trim() ? "border-red-500/40 bg-red-500/[0.01]" : ""
                              )}
                              value={row.data.companyName}
                              onChange={(e) => handleCellChange(idx, 'companyName', e.target.value)}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              className="bg-transparent border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-2 py-1 w-full outline-none transition-all"
                              value={row.data.contactPerson}
                              onChange={(e) => handleCellChange(idx, 'contactPerson', e.target.value)}
                              placeholder="e.g. John Doe"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              className={cn(
                                "bg-transparent border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-855 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-2 py-1 w-full outline-none transition-all text-right font-mono",
                                isWarn && isNaN(Number(String(row.data.dealValue).replace(/[^0-9.]/g, ''))) ? "border-amber-500/30" : ""
                              )}
                              value={row.data.dealValue}
                              onChange={(e) => handleCellChange(idx, 'dealValue', e.target.value)}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              className="bg-transparent border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-2 py-1 w-full outline-none transition-all font-mono"
                              value={row.data.email}
                              onChange={(e) => handleCellChange(idx, 'email', e.target.value)}
                              placeholder="client@company.com"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              className="bg-transparent border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-2 py-1 w-full outline-none transition-all font-mono"
                              value={row.data.phone}
                              onChange={(e) => handleCellChange(idx, 'phone', e.target.value)}
                              placeholder="12345"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              className="bg-transparent border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-2 py-1 w-full outline-none transition-all"
                              value={row.data.website}
                              onChange={(e) => handleCellChange(idx, 'website', e.target.value)}
                              placeholder="company.com"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => handleDeleteRow(idx)}
                              className="text-slate-400 hover:text-red-500 transition-colors p-1"
                              title="Delete row from imports"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between items-center text-[12.5px] mt-2">
            <span className="text-slate-450 italic">
              * Company Name is required. Hover over warnings / error tags to inspect alerts.
            </span>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>Go Back</Button>
              <Button 
                variant="primary" 
                onClick={handleCompleteImport} 
                disabled={stats.error > 0 || stats.total === 0}
                className={cn(stats.error > 0 ? "opacity-50 cursor-not-allowed" : "")}
              >
                ✓ Complete Ingestion ({stats.clean + stats.warning} Clean Leads)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}