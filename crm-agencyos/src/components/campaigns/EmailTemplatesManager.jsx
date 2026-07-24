import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Trash2, Plus, ArrowLeft, Save, Pencil } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { Button, Input } from '../ui';
import { sameId } from '../../utils/helpers';
import RichTextEditor from './RichTextEditor';

const EMPTY_FORM = { name: '', subject: '', bodyHtml: '' };

// Shared list + create/edit/delete UI for the reusable email template
// library. Same EmailTemplate backend/store the Campaign Compose tab's
// "Templates" button reads from — a template created here shows up there,
// and one saved from a campaign's Compose tab shows up here. One library,
// not two disconnected ones.
export default function EmailTemplatesManager() {
  const {
    authUser, emailTemplates, loadEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate, uploadCampaignImage,
  } = useAppStore(useShallow((s) => ({
    authUser: s.authUser,
    emailTemplates: s.emailTemplates,
    loadEmailTemplates: s.loadEmailTemplates,
    createEmailTemplate: s.createEmailTemplate,
    updateEmailTemplate: s.updateEmailTemplate,
    deleteEmailTemplate: s.deleteEmailTemplate,
    uploadCampaignImage: s.uploadCampaignImage,
  })));

  const [view, setView] = useState('list'); // 'list' | 'form'
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadEmailTemplates(); }, [loadEmailTemplates]);

  const canManage = (t) => sameId(t.owner, authUser) || ['admin', 'manager'].includes(authUser?.role);

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setView('form'); };
  const openEdit = (t) => { setEditingId(t._id); setForm({ name: t.name, subject: t.subject || '', bodyHtml: t.bodyHtml || '' }); setView('form'); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) await updateEmailTemplate(editingId, form);
      else await createEmailTemplate(form);
      setView('list');
    } catch {
      // toast already shown by the store action
    } finally {
      setSaving(false);
    }
  };

  if (view === 'form') {
    return (
      <form onSubmit={handleSubmit} className="space-y-3">
        <button type="button" onClick={() => setView('list')} className="flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1">
          <ArrowLeft size={13} /> Back
        </button>
        <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">{editingId ? 'Edit Template' : 'New Template'}</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Template name" placeholder="e.g. Cold outreach — intro" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input label="Email subject" placeholder="Subject line" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
        </div>
        <div>
          <label className="form-label">Email body</label>
          <RichTextEditor
            value={form.bodyHtml}
            onChange={(html) => setForm((f) => ({ ...f, bodyHtml: html }))}
            onUploadImage={uploadCampaignImage}
            placeholder="Write the template content…"
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Type <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">;</code> to browse saved snippets, or type a trigger and press space to expand it.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => setView('list')}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!form.name.trim()}>
            <Save size={14} /> {editingId ? 'Save Changes' : 'Save Template'}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      {emailTemplates.length === 0 ? (
        <p className="text-[13px] text-slate-500 dark:text-slate-400 text-center py-6">
          No saved templates yet — create one to reuse it from any campaign's Compose tab.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {emailTemplates.map((t) => (
            <div key={t._id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex flex-col justify-between">
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-slate-800 dark:text-slate-200 truncate">{t.name}</p>
                <p className="text-[12px] font-semibold text-indigo-500 mt-0.5 truncate">{t.subject || 'No subject'}</p>
              </div>
              {canManage(t) && (
                <div className="flex justify-end gap-1 mt-3">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                    <Pencil size={13} />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => deleteEmailTemplate(t._id)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Button variant="outline" onClick={openCreate}>
        <Plus size={14} /> New Template
      </Button>
    </div>
  );
}
