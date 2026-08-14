import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Facebook, Instagram, Linkedin, Twitter, Youtube, Music2, RotateCcw, XCircle, Trash2, ExternalLink } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { Page, Modal, Button, EmptyState, Select, ConfirmDialog, Skeleton } from '../components/ui';
import { cn } from '../utils/helpers';

const STATUS_BADGE = {
  draft:                { label: 'Draft',     tw: 'badge-neutral' },
  scheduled:             { label: 'Scheduled', tw: 'badge-info' },
  publishing:            { label: 'Publishing', tw: 'badge-warning' },
  partially_published:   { label: 'Partial',   tw: 'badge-warning' },
  published:             { label: 'Published', tw: 'badge-success' },
  failed:                { label: 'Failed',    tw: 'badge-danger' },
  cancelled:             { label: 'Cancelled', tw: 'badge-neutral' },
};

const PUB_STATUS_BADGE = {
  pending:    { label: 'Pending',    tw: 'badge-neutral' },
  publishing: { label: 'Publishing', tw: 'badge-warning' },
  published:  { label: 'Published',  tw: 'badge-success' },
  failed:     { label: 'Failed',     tw: 'badge-danger' },
  cancelled:  { label: 'Cancelled',  tw: 'badge-neutral' },
};

const PLATFORM_ICON = { facebook_page: Facebook, instagram_business: Instagram, linkedin_organization: Linkedin, x: Twitter, youtube: Youtube, tiktok: Music2 };
const PLATFORM_LABEL = { facebook_page: 'Facebook Page', instagram_business: 'Instagram', linkedin_organization: 'LinkedIn Page', x: 'X (Twitter)', youtube: 'YouTube', tiktok: 'TikTok' };

export default function SocialPostsPage() {
  const {
    posts, loadPosts, postDetail, loadPostDetail, deletePost, cancelPost, retryPublication,
  } = useAppStore(useShallow((s) => ({
    posts: s.socialPosts,
    loadPosts: s.loadSocialPosts,
    postDetail: s.socialPostDetail,
    loadPostDetail: s.loadSocialPostDetail,
    deletePost: s.deleteSocialPost,
    cancelPost: s.cancelSocialPost,
    retryPublication: s.retrySocialPublication,
  })));

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [openId, setOpenId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [retryingId, setRetryingId] = useState(null);

  useEffect(() => { loadPosts().finally(() => setLoading(false)); }, [loadPosts]);

  useEffect(() => {
    if (openId) loadPostDetail(openId);
  }, [openId, loadPostDetail]);

  const filtered = useMemo(
    () => statusFilter ? posts.filter((p) => p.status === statusFilter) : posts,
    [posts, statusFilter]
  );

  const handleRetry = async (pubId, postId) => {
    setRetryingId(pubId);
    try { await retryPublication(pubId, postId); } finally { setRetryingId(null); }
  };

  return (
    <Page>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Posts</h1>
          <p className="page-sub">Every post you've drafted, scheduled, or published — with per-platform status</p>
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
          <option value="">All statuses</option>
          {Object.entries(STATUS_BADGE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={Facebook} title="No posts yet" description="Create one from the Composer to see it here." />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 font-semibold">Content</th>
                <th className="px-4 py-2.5 font-semibold">Platforms</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const badge = STATUS_BADGE[p.status] || STATUS_BADGE.draft;
                const when = p.scheduledAt || p.createdAt;
                return (
                  <tr key={p._id} onClick={() => setOpenId(p._id)} className="border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 max-w-[360px]">
                      <p className="truncate text-slate-800 dark:text-slate-200">{p.content || <span className="italic text-slate-400">(no text)</span>}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {(p.selectedAccounts || []).map((a) => {
                          const Icon = PLATFORM_ICON[a.platform];
                          return Icon ? <Icon key={a._id} size={14} className="text-slate-400" /> : null;
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={cn('badge', badge.tw)}>{badge.label}</span></td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{new Date(when).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!openId} onClose={() => setOpenId(null)} title="Post Details" size="lg">
        {postDetail && String(postDetail.post._id) === openId ? (
          <div className="px-6 py-5 space-y-5">
            <div className="flex items-center gap-2">
              <span className={cn('badge', (STATUS_BADGE[postDetail.post.status] || STATUS_BADGE.draft).tw)}>
                {(STATUS_BADGE[postDetail.post.status] || STATUS_BADGE.draft).label}
              </span>
              {postDetail.post.scheduledAt && (
                <span className="text-[12px] text-slate-500 dark:text-slate-400">{new Date(postDetail.post.scheduledAt).toLocaleString()} ({postDetail.post.timezone})</span>
              )}
            </div>

            {postDetail.post.title && <p className="text-[14.5px] font-bold text-slate-900 dark:text-white">{postDetail.post.title}</p>}
            <p className="text-[13.5px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{postDetail.post.content}</p>

            {postDetail.post.media?.[0] && (
              postDetail.post.media[0].type === 'image'
                ? <img src={postDetail.post.media[0].url} alt="" className="max-h-56 rounded-lg" />
                : <video src={postDetail.post.media[0].url} className="max-h-56 rounded-lg" controls />
            )}

            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Per-platform status</p>
              <div className="space-y-2">
                {postDetail.publications.map((pub) => {
                  const Icon = PLATFORM_ICON[pub.platform];
                  const badge = PUB_STATUS_BADGE[pub.status] || PUB_STATUS_BADGE.pending;
                  return (
                    <div key={pub._id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {Icon && <Icon size={14} className="text-slate-400 flex-shrink-0" />}
                          <span className="text-[12.5px] font-medium text-slate-700 dark:text-slate-300 truncate">{pub.socialAccount?.accountName || PLATFORM_LABEL[pub.platform]}</span>
                        </div>
                        <span className={cn('badge', badge.tw)}>{badge.label}</span>
                      </div>
                      {pub.publishedUrl && (
                        <a href={pub.publishedUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11.5px] text-primary-600 hover:underline">
                          <ExternalLink size={11} /> View live post
                        </a>
                      )}
                      {pub.errorMessage && (
                        <p className="text-[11.5px] text-red-500 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded p-2">{pub.errorMessage}</p>
                      )}
                      {pub.status === 'failed' && pub.retryable !== false && (
                        <Button size="xs" variant="outline" onClick={() => handleRetry(pub._id, postDetail.post._id)} loading={retryingId === pub._id}>
                          <RotateCcw size={11} /> Retry
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {['scheduled', 'publishing', 'partially_published'].includes(postDetail.post.status) && (
                <Button variant="outline" size="sm" onClick={() => setConfirmCancel(postDetail.post)}>
                  <XCircle size={13} /> Cancel
                </Button>
              )}
              <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600" onClick={() => setConfirmDelete(postDetail.post)}>
                <Trash2 size={13} /> Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-[13px] text-slate-400">Loading…</div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={async () => { if (confirmCancel) { await cancelPost(confirmCancel._id); setOpenId(null); } }}
        title="Cancel this post?"
        message="Any platforms it hasn't published to yet will be stopped. Platforms it already published to are unaffected."
        confirmLabel="Cancel Post"
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => { if (confirmDelete) { await deletePost(confirmDelete._id); setOpenId(null); } }}
        title="Delete this post?"
        message="This removes it from your Posts list and Calendar. It won't unpublish anything already live on a platform."
        confirmLabel="Delete"
      />
    </Page>
  );
}
