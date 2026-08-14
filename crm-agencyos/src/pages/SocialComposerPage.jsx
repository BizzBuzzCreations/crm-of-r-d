import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import toast from 'react-hot-toast';
import {
  Facebook, Instagram, Linkedin, Twitter, Youtube, Music2, Upload, X, Loader2, Send, Save, CalendarClock, ImageIcon, Video as VideoIcon,
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { Page, Button, Input, Textarea, Select } from '../components/ui';
import { cn } from '../utils/helpers';

// Real platform capabilities — mirrors the values returned by
// modules/social/providers/*/getCapabilities() on the backend (which is
// re-checked authoritatively on submit). Kept here too so the composer can
// show live validation as the user types, without a round trip per keystroke.
const PLATFORM_CAPS = {
  facebook_page:         { label: 'Facebook Page', icon: Facebook,  color: '#1877F2', requiresMedia: false, supportedMediaTypes: ['image', 'video'], maxTextLength: 63206, requiresTitle: false },
  instagram_business:    { label: 'Instagram',      icon: Instagram, color: '#E1306C', requiresMedia: true,  supportedMediaTypes: ['image', 'video'], maxTextLength: 2200,  requiresTitle: false },
  linkedin_organization: { label: 'LinkedIn Page',  icon: Linkedin, color: '#0A66C2', requiresMedia: false, supportedMediaTypes: ['image', 'video'], maxTextLength: 3000,  requiresTitle: false },
  x:                     { label: 'X (Twitter)',    icon: Twitter,  color: '#000000', requiresMedia: false, supportedMediaTypes: ['image', 'video'], maxTextLength: 280,   requiresTitle: false },
  youtube:               { label: 'YouTube',        icon: Youtube,  color: '#FF0000', requiresMedia: true,  supportedMediaTypes: ['video'],           maxTextLength: 5000,  requiresTitle: true },
  tiktok:                { label: 'TikTok',         icon: Music2,   color: '#000000', requiresMedia: true,  supportedMediaTypes: ['video'],           maxTextLength: 2200,  requiresTitle: false },
};

const TIMEZONES = ['Asia/Kolkata', 'UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London'];

function PlatformPreviewCard({ account, content, title, media }) {
  const caps = PLATFORM_CAPS[account.platform] || {};
  const Icon = caps.icon;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        {account.profileImage
          ? <img src={account.profileImage} alt="" className="w-7 h-7 rounded-full object-cover" />
          : <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `${caps.color}18` }}>{Icon && <Icon size={13} style={{ color: caps.color }} />}</div>}
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-200 truncate">{account.accountName}</p>
          <p className="text-[10.5px] text-slate-400">{caps.label}</p>
        </div>
      </div>
      <div className="p-3">
        {caps.requiresTitle && (
          <p className="text-[13px] font-bold text-slate-900 dark:text-white mb-1 break-words">
            {title || <span className="text-slate-350 dark:text-slate-600 italic font-normal">Untitled</span>}
          </p>
        )}
        <p className={cn('text-[12.5px] whitespace-pre-wrap break-words', account.platform === 'instagram_business' && 'text-center')}>
          {content || <span className="text-slate-350 dark:text-slate-600 italic">Nothing written yet…</span>}
        </p>
      </div>
      {media && (
        media.type === 'image'
          ? <img src={media.url} alt="" className={cn('w-full object-cover', account.platform === 'instagram_business' ? 'aspect-square' : 'max-h-64')} />
          : <video src={media.url} className={cn('w-full', account.platform === 'instagram_business' ? 'aspect-square object-cover' : 'max-h-64')} controls />
      )}
    </div>
  );
}

export default function SocialComposerPage() {
  const navigate = useNavigate();
  const { accounts, loadAccounts, createPost, uploadMedia } = useAppStore(useShallow((s) => ({
    accounts: s.socialAccounts,
    loadAccounts: s.loadSocialAccounts,
    createPost: s.createSocialPost,
    uploadMedia: s.uploadSocialMedia,
  })));

  const [content, setContent] = useState('');
  const [title, setTitle] = useState(''); // YouTube video title only
  const [media, setMedia] = useState(null); // { url, type }
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [submitting, setSubmitting] = useState(null); // 'now' | 'draft' | 'schedule' | null
  const fileRef = useRef(null);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const selectedAccounts = useMemo(
    () => accounts.filter((a) => selectedIds.includes(a._id)),
    [accounts, selectedIds]
  );

  // Client-side pre-flight — same rules the backend re-checks on submit
  // (see modules/social/services/socialPostService.validateSelection).
  const validationErrors = useMemo(() => {
    const errors = [];
    for (const a of selectedAccounts) {
      const caps = PLATFORM_CAPS[a.platform];
      if (!caps) continue;
      if (caps.requiresMedia && !media) {
        errors.push(`${a.accountName} (${caps.label}) requires ${caps.supportedMediaTypes.length === 1 ? `a ${caps.supportedMediaTypes[0]}` : 'an image or video'}.`);
      } else if (media && !caps.supportedMediaTypes.includes(media.type)) {
        errors.push(`${a.accountName} only supports ${caps.supportedMediaTypes.join('/')} — the attached ${media.type} won't work here.`);
      }
      if (caps.requiresTitle && !title.trim()) errors.push(`${a.accountName} requires a title.`);
      if (content.length > caps.maxTextLength) errors.push(`${a.accountName}: content exceeds the ${caps.maxTextLength}-character limit.`);
    }
    return errors;
  }, [selectedAccounts, content, title, media]);

  const anyRequiresTitle = selectedAccounts.some((a) => PLATFORM_CAPS[a.platform]?.requiresTitle);

  const toggleAccount = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadMedia(file);
      setMedia(result);
    } catch {
      // toast already shown by the store action
    } finally {
      setUploading(false);
    }
  };

  const resetComposer = () => {
    setContent(''); setTitle(''); setMedia(null); setSelectedIds([]);
    setScheduleOpen(false); setScheduleDate(''); setScheduleTime('');
  };

  const buildBody = () => ({
    content,
    title,
    media: media ? [media] : [],
    accountIds: selectedIds,
  });

  const canSubmit = selectedIds.length > 0 && (content.trim() || media) && validationErrors.length === 0;

  const handleSaveDraft = async () => {
    setSubmitting('draft');
    try {
      await createPost(buildBody());
      toast.success('Draft saved');
      navigate('/social-media/posts');
    } catch {
      // toast already shown
    } finally {
      setSubmitting(null);
    }
  };

  const handlePublishNow = async () => {
    if (!canSubmit) return;
    setSubmitting('now');
    try {
      await createPost({ ...buildBody(), publishNow: true });
      toast.success('Publishing now — check Posts for status');
      navigate('/social-media/posts');
    } catch {
      // toast already shown
    } finally {
      setSubmitting(null);
    }
  };

  const handleSchedule = async () => {
    if (!canSubmit || !scheduleDate || !scheduleTime) return;
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      toast.error('Pick a future date and time');
      return;
    }
    setSubmitting('schedule');
    try {
      await createPost({ ...buildBody(), scheduledAt: scheduledAt.toISOString(), timezone });
      toast.success('Post scheduled');
      navigate('/social-media/calendar');
    } catch {
      // toast already shown
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Page>
      <div className="mb-6">
        <h1 className="page-title">Composer</h1>
        <p className="page-sub">Write once, preview per-platform, and publish now or schedule for later</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <div className="space-y-5">
          <div className="card p-5 space-y-4">
            <div>
              <label className="form-label">Accounts</label>
              {accounts.length === 0 ? (
                <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
                  No accounts connected yet — <button type="button" className="text-primary-600 hover:underline" onClick={() => navigate('/social-media/accounts')}>connect one first</button>.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {accounts.map((a) => {
                    const caps = PLATFORM_CAPS[a.platform] || {};
                    const active = selectedIds.includes(a._id);
                    const Icon = caps.icon;
                    return (
                      <button
                        key={a._id}
                        type="button"
                        onClick={() => toggleAccount(a._id)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold border transition-colors',
                          active ? 'text-white border-transparent' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        )}
                        style={active ? { background: caps.color } : undefined}
                      >
                        {Icon && <Icon size={13} />} {a.accountName}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {anyRequiresTitle && (
              <Input
                label="Title (YouTube)"
                placeholder="Video title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}

            <Textarea
              label={anyRequiresTitle ? 'Description' : 'Content'}
              rows={6}
              placeholder="What do you want to share?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <p className="text-[11px] text-slate-400 -mt-2">{content.length} characters</p>

            <div>
              <label className="form-label">Media (optional)</label>
              {media ? (
                <div className="relative inline-block">
                  {media.type === 'image'
                    ? <img src={media.url} alt="" className="h-32 rounded-lg object-cover" />
                    : <video src={media.url} className="h-32 rounded-lg" controls />}
                  <button type="button" onClick={() => setMedia(null)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
                  onClick={() => !uploading && fileRef.current?.click()}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-xl py-6 cursor-pointer transition-all text-center',
                    dragging ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                  )}
                >
                  {uploading ? (
                    <Loader2 size={18} className="animate-spin text-slate-400" />
                  ) : (
                    <>
                      <Upload size={18} className="text-slate-400" />
                      <p className="text-[12.5px] text-slate-500">Drop an image/video or <span className="text-indigo-500 font-semibold">browse</span></p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1"><ImageIcon size={11} /> Images <VideoIcon size={11} className="ml-1" /> Video</p>
                    </>
                  )}
                  <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
                </div>
              )}
            </div>

            {validationErrors.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 space-y-1">
                {validationErrors.map((e, i) => (
                  <p key={i} className="text-[12px] text-amber-700 dark:text-amber-400">{e}</p>
                ))}
              </div>
            )}
          </div>

          {scheduleOpen && (
            <div className="card p-5 space-y-3">
              <label className="form-label">Schedule for</label>
              <div className="grid grid-cols-3 gap-3">
                <input type="date" className="form-input text-[13px]" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                <input type="time" className="form-input text-[13px]" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </Select>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="outline" onClick={handleSaveDraft} loading={submitting === 'draft'} disabled={!content.trim() && !media}>
              <Save size={14} /> Save Draft
            </Button>
            {!scheduleOpen ? (
              <Button variant="outline" onClick={() => setScheduleOpen(true)} disabled={!canSubmit}>
                <CalendarClock size={14} /> Schedule
              </Button>
            ) : (
              <Button variant="outline" onClick={handleSchedule} loading={submitting === 'schedule'} disabled={!canSubmit || !scheduleDate || !scheduleTime}>
                <CalendarClock size={14} /> Confirm Schedule
              </Button>
            )}
            <Button variant="primary" onClick={handlePublishNow} loading={submitting === 'now'} disabled={!canSubmit}>
              <Send size={14} /> Publish Now
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Preview</p>
          {selectedAccounts.length === 0 ? (
            <div className="card p-5 text-center text-[12.5px] text-slate-400">Select an account to see a preview</div>
          ) : (
            selectedAccounts.map((a) => <PlatformPreviewCard key={a._id} account={a} content={content} title={title} media={media} />)
          )}
        </div>
      </div>
    </Page>
  );
}
