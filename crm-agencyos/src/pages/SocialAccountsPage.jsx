import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import toast from 'react-hot-toast';
import { Facebook, Instagram, Linkedin, Twitter, Youtube, Music2, Trash2, ExternalLink, Plus } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { Page, Button, EmptyState, ConfirmDialog, Skeleton } from '../components/ui';
import { cn } from '../utils/helpers';
import { socialAPI } from '../services/api';

// One Meta App backs both Facebook Pages and Instagram Business accounts
// (Facebook Login for Business) — a single Connect click surfaces both.
const CONNECT_PLATFORMS = [
  { key: 'meta', label: 'Facebook / Instagram', icon: Facebook, color: '#1877F2', description: 'Connect a Facebook Page and its linked Instagram Business account in one step.' },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: '#0A66C2', description: 'Connect a LinkedIn Company Page you administer.' },
  { key: 'x', label: 'X (Twitter)', icon: Twitter, color: '#000000', description: 'Connect your X account. Meaningful posting volume needs a paid X API tier.' },
  { key: 'youtube', label: 'YouTube', icon: Youtube, color: '#FF0000', description: 'Connect a YouTube channel. Video-only — every post needs an attached video.' },
  { key: 'tiktok', label: 'TikTok', icon: Music2, color: '#000000', description: "Connect a TikTok account. Posts publish as private until your app completes TikTok's audit." },
];

const PLATFORM_META = {
  facebook_page:         { label: 'Facebook Page', icon: Facebook, color: '#1877F2' },
  instagram_business:    { label: 'Instagram',      icon: Instagram, color: '#E1306C' },
  linkedin_organization: { label: 'LinkedIn Page',  icon: Linkedin, color: '#0A66C2' },
  x:                     { label: 'X (Twitter)',    icon: Twitter, color: '#000000' },
  youtube:               { label: 'YouTube',        icon: Youtube, color: '#FF0000' },
  tiktok:                { label: 'TikTok',         icon: Music2, color: '#000000' },
};

const STATUS_BADGE = {
  active:  { label: 'Active',  tw: 'badge-success' },
  expired: { label: 'Reconnect needed', tw: 'badge-warning' },
  revoked: { label: 'Revoked', tw: 'badge-danger' },
  error:   { label: 'Error',   tw: 'badge-danger' },
};

const ERROR_MESSAGES = {
  denied: "You didn't approve the connection request.",
  missing_code: 'The platform did not return an authorization code.',
  invalid_state: 'That connection attempt expired or was invalid — try again.',
  not_configured: "This platform isn't configured yet — add its App ID/Secret in Settings → Social Media Platforms first.",
  connect_failed: 'Could not complete the connection. Check the platform app credentials and try again.',
};

export default function SocialAccountsPage() {
  const { accounts, loadAccounts, disconnectAccount } = useAppStore(useShallow((s) => ({
    accounts: s.socialAccounts,
    loadAccounts: s.loadSocialAccounts,
    disconnectAccount: s.disconnectSocialAccount,
  })));

  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    loadAccounts().finally(() => setLoading(false));
  }, [loadAccounts]);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      toast.success(`Connected ${connected} account${connected === '1' ? '' : 's'}`);
      loadAccounts();
    } else if (error) {
      toast.error(ERROR_MESSAGES[error] || 'Connection failed');
    }
    if (connected || error) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Page>
      <div className="mb-6">
        <h1 className="page-title">Connected Accounts</h1>
        <p className="page-sub">Connect your Facebook Page, Instagram Business account, and LinkedIn Company Page to post and schedule content from one place</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {CONNECT_PLATFORMS.map((p) => (
          <div key={p.key} className="card p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${p.color}18` }}>
                <p.icon size={20} style={{ color: p.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-slate-900 dark:text-white">{p.label}</p>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">{p.description}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0"
              onClick={() => { window.location.href = socialAPI.connectUrl(p.key); }}
            >
              <Plus size={14} /> Connect
            </Button>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Facebook}
            title="No accounts connected yet"
            description="Use the Connect buttons above to link a Facebook Page, Instagram Business account, or LinkedIn Company Page."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((a) => {
            const meta = PLATFORM_META[a.platform] || {};
            const badge = STATUS_BADGE[a.status] || STATUS_BADGE.active;
            return (
              <div key={a._id} className="card p-4 flex items-center gap-3">
                {a.profileImage ? (
                  <img src={a.profileImage} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${meta.color}18` }}>
                    {meta.icon && <meta.icon size={18} style={{ color: meta.color }} />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-slate-900 dark:text-white truncate">{a.accountName}</p>
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{meta.label}{a.username ? ` · @${a.username}` : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className={cn('badge', badge.tw)}>{badge.label}</span>
                  <button onClick={() => setConfirmDelete(a)} className="text-slate-400 hover:text-red-500" title="Disconnect">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11.5px] text-slate-400 dark:text-slate-500 mt-6 flex items-center gap-1.5">
        <ExternalLink size={11} /> App credentials for these platforms are configured in Settings → Meta App / LinkedIn App (admin only).
      </p>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && disconnectAccount(confirmDelete._id)}
        title="Disconnect account?"
        message={`"${confirmDelete?.accountName}" will no longer be available to post to. Any posts already scheduled to it will fail when their time comes.`}
        confirmLabel="Disconnect"
      />
    </Page>
  );
}
