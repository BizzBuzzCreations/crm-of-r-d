import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { Search, Plus, Play, Pause, Trash2 } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { Page, Button, Modal, Input, EmptyState, ConfirmDialog, Skeleton } from '../components/ui';
import { cn } from '../utils/helpers';

const STATUS_BADGE = {
  draft:     { label: 'Draft',     tw: 'badge-neutral' },
  crawling:  { label: 'Crawling',  tw: 'badge-info' },
  paused:    { label: 'Paused',    tw: 'badge-warning' },
  completed: { label: 'Completed', tw: 'badge-success' },
};

export default function ProspectAuditsPage() {
  const navigate = useNavigate();
  const {
    batches, loadBatches, createBatch, deleteBatch, startCrawl, pauseCrawl,
  } = useAppStore(useShallow((s) => ({
    batches: s.prospectAuditBatches,
    loadBatches: s.loadProspectAuditBatches,
    createBatch: s.createProspectAuditBatch,
    deleteBatch: s.deleteProspectAuditBatch,
    startCrawl: s.startProspectAuditCrawl,
    pauseCrawl: s.pauseProspectAuditCrawl,
  })));

  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    loadBatches().finally(() => setLoading(false));
  }, [loadBatches]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const batch = await createBatch({ name: name.trim() });
      setCreateOpen(false);
      setName('');
      navigate(`/prospect-audits/${batch._id}`);
    } catch {
      // toast already shown by the store action
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = (batch) => {
    if (batch.status === 'crawling') pauseCrawl(batch._id);
    else startCrawl(batch._id);
  };

  return (
    <Page>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Prospect Audits</h1>
          <p className="page-sub">Import business lists, crawl their websites for technical/SEO health, and export a prioritized list for outreach</p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus size={15} /> New Batch
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : batches.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Search}
            title="No prospect audit batches yet"
            description="Import a list of businesses (name, phone, email, website) and crawl each site for technical/SEO issues — no AI, no browser automation, just fast rule-based scoring."
            action={<Button variant="primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> New Batch</Button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map((b) => {
            const badge = STATUS_BADGE[b.status] || STATUS_BADGE.draft;
            const progress = b.totalCount ? Math.round((b.crawledCount / b.totalCount) * 100) : 0;
            return (
              <div
                key={b._id}
                className="card p-5 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/prospect-audits/${b._id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold text-slate-900 dark:text-white truncate">{b.name}</p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {b.totalCount || 0} business{b.totalCount === 1 ? '' : 'es'}
                    </p>
                  </div>
                  <span className={cn('badge', badge.tw)}>{badge.label}</span>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    <span>Crawled</span>
                    <span>{b.crawledCount || 0} / {b.totalCount || 0}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {(b.status === 'draft' || b.status === 'paused') && (
                    <Button variant="outline" size="sm" onClick={() => handleToggleStatus(b)}>
                      <Play size={13} /> Start
                    </Button>
                  )}
                  {b.status === 'crawling' && (
                    <Button variant="outline" size="sm" onClick={() => handleToggleStatus(b)}>
                      <Pause size={13} /> Pause
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(b)} className="ml-auto text-red-500 hover:text-red-600">
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Batch" size="sm">
        <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
          <Input
            label="Batch name"
            placeholder="e.g. Debt Advisors — UK, August"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            You'll import your business list on the next screen.
          </p>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={creating} disabled={!name.trim()}>Create Batch</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteBatch(confirmDelete._id)}
        title="Delete batch?"
        message={`This will permanently remove "${confirmDelete?.name}" and all its crawled prospects.`}
        confirmLabel="Delete"
      />
    </Page>
  );
}
