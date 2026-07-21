import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { FileText, Trash2, Plus, ArrowLeft, Save } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { Modal, Button, Input } from '../ui';
import { sameId } from '../../utils/helpers';

// Browse/apply a saved template, or save the campaign's current subject+body
// as a new one. Templates are a shared library (anyone with campaign access
// can use them), editable only by their creator or an admin/manager.
export default function EmailTemplatesModal({ open, onClose, onSelect, currentSubject, currentBody }) {
  const {
    authUser, emailTemplates, loadEmailTemplates, createEmailTemplate, deleteEmailTemplate,
  } = useAppStore(useShallow((s) => ({
    authUser: s.authUser,
    emailTemplates: s.emailTemplates,
    loadEmailTemplates: s.loadEmailTemplates,
    createEmailTemplate: s.createEmailTemplate,
    deleteEmailTemplate: s.deleteEmailTemplate,
  })));

  const [view, setView] = useState('list');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) loadEmailTemplates(); }, [open, loadEmailTemplates]);
  useEffect(() => { if (!open) { setView('list'); setName(''); } }, [open]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createEmailTemplate({ name: name.trim(), subject: currentSubject, bodyHtml: currentBody });
      setName('');
      setView('list');
    } catch {
      // toast already shown
    } finally {
      setSaving(false);
    }
  };

  const canManage = (t) => sameId(t.owner, authUser) || ['admin', 'manager'].includes(authUser?.role);

  return (
    <Modal open={open} onClose={onClose} title={view === 'list' ? 'Email Templates' : 'Save as Template'} size="md">
      {view === 'list' ? (
        <div className="px-6 py-5">
          {emailTemplates.length === 0 ? (
            <p className="text-[13px] text-slate-500 dark:text-slate-400 text-center py-6">
              No saved templates yet.
            </p>
          ) : (
            <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
              {emailTemplates.map((t) => (
                <div key={t._id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button type="button" onClick={() => { onSelect(t); onClose(); }} className="min-w-0 flex-1 text-left flex items-center gap-2.5">
                    <FileText size={15} className="text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 truncate">{t.name}</p>
                      <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{t.subject || 'No subject'}</p>
                    </div>
                  </button>
                  {canManage(t) && (
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 flex-shrink-0" onClick={() => deleteEmailTemplate(t._id)}>
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" className="w-full" onClick={() => setView('save')}>
            <Plus size={14} /> Save Current Email as Template
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSave} className="px-6 py-5 space-y-3">
          <button type="button" onClick={() => setView('list')} className="flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1">
            <ArrowLeft size={13} /> Back
          </button>
          <Input label="Template name" placeholder="e.g. Cold outreach — intro" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400">Saves the current subject and body exactly as they are now.</p>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="outline" onClick={() => setView('list')}>Cancel</Button>
            <Button type="submit" variant="primary" loading={saving} disabled={!name.trim()}>
              <Save size={14} /> Save Template
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
