import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Plus, Trash2, CheckCircle2, XCircle, Loader2, ArrowLeft, Inbox, X, AlertTriangle, Pencil, Flame, ShieldCheck } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { Button, Input, Toggle } from '../ui';
import { cn, sameId } from '../../utils/helpers';

const EMPTY_FORM = {
  name: '', email: '', fromName: '', replyTo: '',
  smtpHost: '', smtpPort: 587, smtpSecure: false, smtpUser: '', smtpPass: '', smtpAllowInsecureTLS: false,
  imapEnabled: false, imapHost: '', imapPort: 993, imapSecure: true, imapUser: '', imapPass: '', imapAllowInsecureTLS: false,
  dailySendLimit: 100, warmupEnabled: false, warmupDays: 14, warmupStartLimit: 5,
};

// Mirrors backend utils/warmup.js — just for display, backend is authoritative
function warmupProgress(a) {
  if (!a.warmupEnabled || !a.warmupStartDate) return null;
  const daysElapsed = Math.floor((Date.now() - new Date(a.warmupStartDate).getTime()) / 86400000);
  const done = daysElapsed >= a.warmupDays;
  const dayNum = Math.min(daysElapsed + 1, a.warmupDays);
  const progress = a.warmupDays > 0 ? Math.min(1, daysElapsed / a.warmupDays) : 1;
  const current = done ? a.dailySendLimit : Math.round(a.warmupStartLimit + (a.dailySendLimit - a.warmupStartLimit) * progress);
  return { done, dayNum, totalDays: a.warmupDays, current };
}

function InsecureTlsCheckbox({ checked, onChange }) {
  return (
    <label className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 rounded border-amber-300" />
      <span className="text-[11.5px] text-amber-700 dark:text-amber-400">
        <AlertTriangle size={11} className="inline -mt-0.5 mr-1" />
        Allow self-signed / untrusted certificate <span className="text-amber-600/80 dark:text-amber-500/80">(insecure — only for internal or self-hosted mail servers you trust)</span>
      </span>
    </label>
  );
}

// Shared list + add/test/delete UI for connected mailboxes (SMTP for
// sending, optional IMAP for inbox sync). Used both standalone in Settings
// ("my mailboxes") and inside the Campaign settings "Manage accounts" modal
// — same data, same component, no duplicated form code.
export default function EmailAccountsManager({ initialView = 'list', showBackFromAdd = true }) {
  const {
    authUser, emailAccounts, loadEmailAccounts, createEmailAccount, updateEmailAccount, deleteEmailAccount, testEmailAccount, checkAccountDomain,
  } = useAppStore(useShallow((s) => ({
    authUser: s.authUser,
    emailAccounts: s.emailAccounts,
    loadEmailAccounts: s.loadEmailAccounts,
    createEmailAccount: s.createEmailAccount,
    updateEmailAccount: s.updateEmailAccount,
    deleteEmailAccount: s.deleteEmailAccount,
    testEmailAccount: s.testEmailAccount,
    checkAccountDomain: s.checkAccountDomain,
  })));

  const [view, setView] = useState(initialView);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [results, setResults] = useState({}); // accountId -> { success, smtp, imap }
  const [domainCheckingId, setDomainCheckingId] = useState(null);
  const [domainResults, setDomainResults] = useState({}); // accountId -> { spf, dmarc, dkim }

  useEffect(() => { loadEmailAccounts(); }, [loadEmailAccounts]);

  const canManage = (a) => sameId(a.owner, authUser) || ['admin', 'manager'].includes(authUser?.role);

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); };

  const handleEditOpen = (a) => {
    setForm({
      name: a.name || '', email: a.email || '', fromName: a.fromName || '', replyTo: a.replyTo || '',
      smtpHost: a.smtpHost || '', smtpPort: a.smtpPort || 587, smtpSecure: !!a.smtpSecure,
      smtpUser: a.smtpUser || '', smtpPass: '', smtpAllowInsecureTLS: !!a.smtpAllowInsecureTLS,
      imapEnabled: !!a.imapEnabled, imapHost: a.imapHost || '', imapPort: a.imapPort || 993,
      imapSecure: a.imapSecure !== false, imapUser: a.imapUser || '', imapPass: '', imapAllowInsecureTLS: !!a.imapAllowInsecureTLS,
      dailySendLimit: a.dailySendLimit ?? 100,
      warmupEnabled: !!a.warmupEnabled, warmupDays: a.warmupDays ?? 14, warmupStartLimit: a.warmupStartLimit ?? 5,
    });
    setEditingId(a._id);
    setView('add');
  };

  const handleDomainCheck = async (id) => {
    setDomainCheckingId(id);
    try {
      const result = await checkAccountDomain(id);
      setDomainResults((r) => ({ ...r, [id]: result }));
    } catch {
      // toast already shown
    } finally {
      setDomainCheckingId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) await updateEmailAccount(editingId, form);
      else await createEmailAccount(form);
      resetForm();
      setView('list');
    } catch {
      // toast already shown by the store action
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (id) => {
    setTestingId(id);
    setResults((r) => { const n = { ...r }; delete n[id]; return n; });
    const result = await testEmailAccount(id);
    setResults((r) => ({ ...r, [id]: result }));
    setTestingId(null);
  };

  const copyFromSmtp = () => setForm((f) => ({ ...f, imapUser: f.smtpUser, imapPass: f.smtpPass }));

  if (view === 'add') {
    return (
      <form onSubmit={handleSubmit} className="space-y-3">
        {showBackFromAdd && (
          <button type="button" onClick={() => { resetForm(); setView('list'); }} className="flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1">
            <ArrowLeft size={13} /> Back
          </button>
        )}
        <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">{editingId ? 'Edit Mailbox' : 'Add Mailbox'}</p>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Account name" placeholder="e.g. Omar (Sales)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input label="Email address" type="email" placeholder="omar@company.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="From name (optional)" placeholder="Omar from Company" value={form.fromName} onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))} />
          <Input label="Reply-to (optional)" type="email" value={form.replyTo} onChange={(e) => setForm((f) => ({ ...f, replyTo: e.target.value }))} />
        </div>

        <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400 pt-1">SMTP — sending</p>
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <Input label="SMTP host" placeholder="smtp.gmail.com" value={form.smtpHost} onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))} required />
          <Input label="Port" type="number" value={form.smtpPort} onChange={(e) => setForm((f) => ({ ...f, smtpPort: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="SMTP username" value={form.smtpUser} onChange={(e) => setForm((f) => ({ ...f, smtpUser: e.target.value }))} required />
          <Input
            label={editingId ? 'SMTP password (leave blank to keep current)' : 'SMTP password'}
            type="password" value={form.smtpPass}
            onChange={(e) => setForm((f) => ({ ...f, smtpPass: e.target.value }))}
            required={!editingId}
          />
        </div>
        <Toggle
          checked={form.smtpSecure}
          onChange={(v) => setForm((f) => ({ ...f, smtpSecure: v }))}
          label="Use SSL/TLS (port 465)"
          description="Leave off for STARTTLS on port 587 — most SMTP providers use 587"
        />
        <InsecureTlsCheckbox checked={form.smtpAllowInsecureTLS} onChange={(v) => setForm((f) => ({ ...f, smtpAllowInsecureTLS: v }))} />

        <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400 pt-1">Sending limits</p>
        <Input
          label="Daily send limit"
          type="number" min="1"
          value={form.dailySendLimit}
          onChange={(e) => setForm((f) => ({ ...f, dailySendLimit: e.target.value }))}
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-2">
          Hard ceiling for this mailbox, shared across every campaign using it — protects the account's reputation regardless of which campaign is sending.
        </p>
        <Toggle
          checked={form.warmupEnabled}
          onChange={(v) => setForm((f) => ({ ...f, warmupEnabled: v }))}
          label="Warm up this account"
          description="New/unfamiliar accounts get flagged for sudden volume — ramp up gradually instead of starting at full limit"
        />
        {form.warmupEnabled && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/50">
            <Input
              label="Starting daily limit"
              type="number" min="1"
              value={form.warmupStartLimit}
              onChange={(e) => setForm((f) => ({ ...f, warmupStartLimit: e.target.value }))}
            />
            <Input
              label="Ramp-up period (days)"
              type="number" min="1"
              value={form.warmupDays}
              onChange={(e) => setForm((f) => ({ ...f, warmupDays: e.target.value }))}
            />
            <p className="col-span-2 text-[11px] text-orange-700 dark:text-orange-400">
              Sends {form.warmupStartLimit || 0}/day on day 1, increasing linearly to {form.dailySendLimit || 0}/day by day {form.warmupDays || 0}.
              {editingId ? ' Turning this on (from off) restarts the ramp from today.' : ''}
            </p>
          </div>
        )}

        <div className="pt-1">
          <Toggle
            checked={form.imapEnabled}
            onChange={(v) => setForm((f) => ({ ...f, imapEnabled: v }))}
            label="Enable IMAP (inbox sync)"
            description="Connects the incoming mailbox — needed to sync replies from this address"
          />
        </div>

        {form.imapEnabled && (
          <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">IMAP — receiving</p>
              <button type="button" onClick={copyFromSmtp} className="text-[11px] font-medium text-primary-600 hover:underline">
                Same credentials as SMTP
              </button>
            </div>
            <div className="grid grid-cols-[2fr_1fr] gap-3">
              <Input label="IMAP host" placeholder="imap.gmail.com" value={form.imapHost} onChange={(e) => setForm((f) => ({ ...f, imapHost: e.target.value }))} required={form.imapEnabled} />
              <Input label="Port" type="number" value={form.imapPort} onChange={(e) => setForm((f) => ({ ...f, imapPort: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="IMAP username" value={form.imapUser} onChange={(e) => setForm((f) => ({ ...f, imapUser: e.target.value }))} required={form.imapEnabled} />
              <Input
                label={editingId ? 'IMAP password (leave blank to keep current)' : 'IMAP password'}
                type="password" value={form.imapPass}
                onChange={(e) => setForm((f) => ({ ...f, imapPass: e.target.value }))}
                required={form.imapEnabled && !editingId}
              />
            </div>
            <Toggle
              checked={form.imapSecure}
              onChange={(v) => setForm((f) => ({ ...f, imapSecure: v }))}
              label="Use SSL/TLS (port 993)"
              description="Standard for IMAP — leave on unless your provider says otherwise"
            />
            <InsecureTlsCheckbox checked={form.imapAllowInsecureTLS} onChange={(v) => setForm((f) => ({ ...f, imapAllowInsecureTLS: v }))} />
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" onClick={() => { resetForm(); setView('list'); }}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>{editingId ? 'Save Changes' : 'Add Account'}</Button>
        </div>
      </form>
    );
  }

  return (
    <div>
      {emailAccounts.length === 0 ? (
        <p className="text-[13px] text-slate-500 dark:text-slate-400 text-center py-6">
          No connected mailboxes yet. Add one to send campaigns and sync replies.
        </p>
      ) : (
        <div className="space-y-2 mb-4">
          {emailAccounts.map((a) => {
            const result = results[a._id];
            const domainResult = domainResults[a._id];
            const mine = canManage(a);
            const warmup = warmupProgress(a);
            return (
              <div key={a._id} className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 truncate">{a.name}</p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate">
                      {a.email}
                      {!sameId(a.owner, authUser) && a.owner?.name && <span className="text-slate-400"> · {a.owner.name}</span>}
                    </p>
                    {warmup && (
                      <p className="text-[11px] text-orange-600 dark:text-orange-400 flex items-center gap-1 mt-0.5">
                        <Flame size={10} />
                        {warmup.done ? `Warm-up complete — ${warmup.current}/day` : `Warming up — day ${warmup.dayNum}/${warmup.totalDays}, ${warmup.current}/day`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span title={a.lastSmtpVerifyError || 'SMTP'} className="flex items-center gap-0.5">
                      {a.lastSmtpVerifiedAt && !a.lastSmtpVerifyError ? (
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      ) : a.lastSmtpVerifyError ? (
                        <XCircle size={14} className="text-red-500" />
                      ) : (
                        <CheckCircle2 size={14} className="text-slate-300 dark:text-slate-600" />
                      )}
                    </span>
                    {a.imapEnabled && (
                      <span title={a.lastImapVerifyError || 'IMAP'} className="flex items-center gap-0.5">
                        <Inbox size={13} className={cn(
                          a.lastImapVerifiedAt && !a.lastImapVerifyError ? 'text-emerald-500' :
                          a.lastImapVerifyError ? 'text-red-500' : 'text-slate-300 dark:text-slate-600'
                        )} />
                      </span>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleTest(a._id)} disabled={testingId === a._id}>
                      {testingId === a._id ? <Loader2 size={13} className="animate-spin" /> : 'Test'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDomainCheck(a._id)} disabled={domainCheckingId === a._id} title="Check SPF/DKIM/DMARC for this domain">
                      {domainCheckingId === a._id ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                    </Button>
                    {mine && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => handleEditOpen(a)}>
                          <Pencil size={13} />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => deleteEmailAccount(a._id)}>
                          <Trash2 size={13} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {result && (
                  <div className={cn(
                    'flex items-start justify-between gap-2 px-3 py-2 text-[12px] border-t',
                    result.success
                      ? 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-100 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-50 dark:bg-red-900/15 border-red-100 dark:border-red-900 text-red-700 dark:text-red-300'
                  )}>
                    <div className="flex-1">
                      {result.success ? (
                        <span className="font-semibold">✓ Connection successful</span>
                      ) : (
                        <>
                          <span className="font-semibold">Connection failed</span>
                          {result.smtp && !result.smtp.ok && <div>SMTP: {result.smtp.message}</div>}
                          {result.imap && !result.imap.ok && <div>IMAP: {result.imap.message}</div>}
                        </>
                      )}
                    </div>
                    <button onClick={() => setResults((r) => { const n = { ...r }; delete n[a._id]; return n; })} className="opacity-60 hover:opacity-100">
                      <X size={12} />
                    </button>
                  </div>
                )}

                {domainResult && (
                  <div className="px-3 py-2.5 text-[12px] border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Domain authentication — {domainResult.domain}</span>
                      <button onClick={() => setDomainResults((r) => { const n = { ...r }; delete n[a._id]; return n; })} className="opacity-60 hover:opacity-100">
                        <X size={12} />
                      </button>
                    </div>
                    {['spf', 'dmarc', 'dkim'].map((key) => {
                      const r = domainResult[key];
                      // "Found" isn't the same as "doing anything" — e.g. a
                      // DMARC record can exist with p=none (monitoring only,
                      // no real enforcement). Surface that note even when found.
                      const weak = r.found && !!r.detail;
                      return (
                        <div key={key} className="flex items-start gap-1.5">
                          {r.found
                            ? <CheckCircle2 size={13} className={cn('flex-shrink-0 mt-0.5', weak ? 'text-amber-500' : 'text-emerald-500')} />
                            : <XCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />}
                          <div>
                            <span className="font-medium uppercase text-slate-700 dark:text-slate-300">{key}</span>
                            {' — '}
                            <span className={r.found ? (weak ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400') : 'text-red-500'}>
                              {r.found ? (r.detail || 'Found') : (r.detail || 'Not found')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {(!domainResult.spf.found || !domainResult.dmarc.found) && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 pt-1">
                        Missing SPF/DMARC records are the single biggest reason legitimate campaign email lands in spam. These have to be added as DNS TXT records on your domain registrar/DNS host — not something this app can set for you.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Button variant="outline" className="w-full" onClick={() => { resetForm(); setView('add'); }}>
        <Plus size={14} /> Add Mailbox
      </Button>
    </div>
  );
}
