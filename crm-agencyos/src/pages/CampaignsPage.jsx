import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { Mail, Plus, Play, Pause, Trash2, Send, MailOpen, MousePointerClick, Users, XCircle } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { Page, Button, Modal, Input, Badge, EmptyState, ConfirmDialog, Skeleton } from '../components/ui';
import { cn } from '../utils/helpers';

const STATUS_BADGE = {
  draft:     { label: 'Draft',     tw: 'badge-neutral' },
  scheduled: { label: 'Scheduled', tw: 'badge-purple' },
  active:    { label: 'Active',    tw: 'badge-success' },
  paused:    { label: 'Paused',    tw: 'badge-warning' },
  completed: { label: 'Completed', tw: 'badge-info' },
};

export default function CampaignsPage() {
  const navigate = useNavigate();
  const {
    campaigns, loadCampaigns, createCampaign, deleteCampaign, startCampaign, pauseCampaign, unscheduleCampaign,
  } = useAppStore(useShallow((s) => ({
    campaigns: s.campaigns,
    loadCampaigns: s.loadCampaigns,
    createCampaign: s.createCampaign,
    deleteCampaign: s.deleteCampaign,
    startCampaign: s.startCampaign,
    pauseCampaign: s.pauseCampaign,
    unscheduleCampaign: s.unscheduleCampaign,
  })));

  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    loadCampaigns().finally(() => setLoading(false));
  }, [loadCampaigns]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const campaign = await createCampaign({ name: name.trim() });
      setCreateOpen(false);
      setName('');
      navigate(`/campaigns/${campaign._id}`);
    } catch {
      // toast already shown by the store action
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = (campaign) => {
    if (campaign.status === 'active') pauseCampaign(campaign._id);
    else startCampaign(campaign._id);
  };

  return (
    <Page>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-sub">Create bulk email campaigns, import leads, and track sends</p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus size={15} /> New Campaign
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Mail}
            title="No campaigns yet"
            description="Create your first bulk email campaign — import leads, compose your message, and control sending pace."
            action={<Button variant="primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> New Campaign</Button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => {
            const stats = c.stats || {};
            const badge = STATUS_BADGE[c.status] || STATUS_BADGE.draft;
            return (
              <div
                key={c._id}
                className="card p-5 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/campaigns/${c._id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold text-slate-900 dark:text-white truncate">{c.name}</p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {stats.total || 0} lead{stats.total === 1 ? '' : 's'}
                      {c.status === 'scheduled' && c.scheduledAt && ` · starts ${new Date(c.scheduledAt).toLocaleString()}`}
                    </p>
                  </div>
                  <span className={cn('badge', badge.tw)}>{badge.label}</span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  <StatMini icon={Send} label="Sent" value={stats.sent || 0} />
                  <StatMini icon={MailOpen} label="Opened" value={stats.opened || 0} />
                  <StatMini icon={MousePointerClick} label="Clicked" value={stats.clicked || 0} />
                  <StatMini icon={Users} label="Replied" value={stats.replied || 0} />
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {c.status === 'scheduled' ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => unscheduleCampaign(c._id)}>
                        <XCircle size={13} /> Cancel
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleToggleStatus(c)}>
                        <Play size={13} /> Start now
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* "completed" isn't necessarily terminal — the backend allows
                          restarting once new leads exist (no status guard there),
                          so show Start again if there's actually something pending. */}
                      {(c.status === 'draft' || c.status === 'paused' || (c.status === 'completed' && (stats.pending || 0) > 0)) && (
                        <Button variant="outline" size="sm" onClick={() => handleToggleStatus(c)}>
                          <Play size={13} /> Start
                        </Button>
                      )}
                      {c.status === 'active' && (
                        <Button variant="outline" size="sm" onClick={() => handleToggleStatus(c)}>
                          <Pause size={13} /> Pause
                        </Button>
                      )}
                    </>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(c)} className="ml-auto text-red-500 hover:text-red-600">
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Campaign" size="sm">
        <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
          <Input
            label="Campaign name"
            placeholder="e.g. Q3 Outreach — Debt Advisors"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            You'll import leads, write the email, and configure sending settings on the next screen.
          </p>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={creating} disabled={!name.trim()}>Create Campaign</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteCampaign(confirmDelete._id)}
        title="Delete campaign?"
        message={`This will permanently remove "${confirmDelete?.name}" and stop any in-progress sending. Imported leads and send history will no longer be accessible.`}
        confirmLabel="Delete"
      />
    </Page>
  );
}

function StatMini({ icon: Icon, label, value }) {
  return (
    <div className="flex flex-col items-center justify-center py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
      <Icon size={13} className="text-slate-400 mb-1" />
      <span className="text-[13px] font-bold text-slate-800 dark:text-slate-200 leading-none">{value}</span>
      <span className="text-[9.5px] text-slate-500 dark:text-slate-400 mt-0.5">{label}</span>
    </div>
  );
}
