import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { KeyRound, Plus, Trash2, Copy, BookOpen } from 'lucide-react';
import api, { apiKeysAPI } from '../services/api';
import { Page, Button, Modal, EmptyState, ConfirmDialog } from '../components/ui';
import ApiDocsModal from '../components/ApiDocsModal';

function fmtDate(iso) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Admin → API Keys. Credentials for external systems (currently: the main
// CRM) to call rndCRM's external API — see backend/src/external-api/. Not
// scoped to one feature: a key grants access to every domain under
// external-api/ (Lead Sync today, more later), auth is enforced by
// external-api/middleware/apiKeyAuth.js, and keys are created/revoked here
// instead of a hardcoded .env secret.
export default function ApiKeysPage() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDocs, setShowDocs] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealKey, setRevealKey] = useState(null); // { name, key }
  const [pendingDelete, setPendingDelete] = useState(null); // key doc

  const load = async () => {
    try {
      const { data } = await apiKeysAPI.getKeys();
      setKeys(data.data);
    } catch {
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const { data } = await apiKeysAPI.createKey({ name: name.trim() });
      setShowCreate(false);
      setName('');
      setRevealKey({ name: data.data.name, key: data.data.key });
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await apiKeysAPI.deleteKey(target._id);
      toast.success(`"${target.name}" revoked`);
      setKeys((prev) => prev.filter((k) => k._id !== target._id));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to revoke key');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  return (
    <Page>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">API Keys</h1>
          <p className="page-sub">
            {keys.length} key{keys.length === 1 ? '' : 's'} · credentials for external systems (e.g. the main CRM) calling rndCRM's APIs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDocs(true)}>
            <BookOpen size={14} /> Documentation
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Create API Key
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-[13px] text-slate-400">Loading…</p>
      ) : keys.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No API keys yet"
          description="Create one to let an external system, like the main CRM, call rndCRM's external API. See the docs for the full endpoint reference."
          action={
            <div className="flex items-center gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => setShowDocs(true)}><BookOpen size={14} /> Documentation</Button>
              <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Create API Key</Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-3 max-w-3xl">
          {keys.map((k) => (
            <div key={k._id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 flex items-center justify-between gap-4">
              <div className="min-w-0 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <KeyRound size={16} className="text-indigo-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-slate-850 dark:text-slate-200 truncate">{k.name}</p>
                  <code className="text-[11.5px] text-slate-450">{k.keyPrefix}••••••••••••••••••••••••••</code>
                  <p className="text-[11.5px] text-slate-400 mt-0.5">
                    Created {fmtDate(k.createdAt)}{k.createdBy?.name ? ` by ${k.createdBy.name}` : ''} · Last used {fmtDate(k.lastUsedAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPendingDelete(k)}
                title="Revoke key"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create API Key"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={creating}>Create</Button>
          </>
        }
      >
        <div className="p-6">
          <label className="block text-[11px] font-bold text-slate-450 uppercase tracking-widest mb-1.5">Name</label>
          <input
            className="form-input text-[13px]"
            placeholder="e.g. Main CRM - Lead Sync"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            autoFocus
          />
          <p className="text-[11.5px] text-slate-450 mt-1.5">A label so you know what this key is for — it doesn't restrict what the key can access.</p>
        </div>
      </Modal>

      {/* Reveal-once modal — the raw key is never shown again after this */}
      {revealKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setRevealKey(null)}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">API Key for {revealKey.name}</h3>
            <p className="text-[12.5px] text-red-500 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-2.5">
              Save this now — it will never be shown again. Give it only to the system's own backend config (e.g. the main CRM's .env), never to browser/frontend code.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[12.5px] bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg break-all">{revealKey.key}</code>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(revealKey.key)}><Copy size={13} /> Copy</Button>
            </div>
            <div>
              <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Example usage (Lead Sync — see Documentation for every endpoint)</p>
              <pre className="text-[12px] bg-slate-900 text-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{`GET ${api.defaults.baseURL}/lead-sync/email-activity?email=<lead email>&secret=${revealKey.key}`}</pre>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => { setRevealKey(null); setShowDocs(true); }}><BookOpen size={14} /> View Documentation</Button>
              <Button variant="primary" onClick={() => setRevealKey(null)}>Done</Button>
            </div>
          </div>
        </div>
      )}

      <ApiDocsModal open={showDocs} onClose={() => setShowDocs(false)} />

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title="Revoke API Key"
        message={pendingDelete ? `Revoke "${pendingDelete.name}"? Any system still using this key will immediately start getting 401 errors.` : ''}
        confirmLabel="Revoke"
        variant="danger"
      />
    </Page>
  );
}
