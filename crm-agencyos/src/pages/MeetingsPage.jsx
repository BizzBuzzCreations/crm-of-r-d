import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Plus, Video, MapPin, Clock, Calendar, Edit, Trash2,
  ExternalLink, Users, CheckCircle, Circle,
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/shallow';
import {
  Page, Button, Badge, Avatar, AvatarGroup, Tabs, Modal,
  Input, Select, Textarea, EmptyState, ConfirmDialog,
} from '../components/ui';
import { cn, MEETING_TYPE_CONFIG, canManage } from '../utils/helpers';

// ── Meeting Card ──────────────────────────────────────────────
function MeetingCard({ meeting, users, clients, role, onEdit, onDelete }) {
  const tc           = MEETING_TYPE_CONFIG[meeting.type] || MEETING_TYPE_CONFIG.internal;
  const participants = users.filter((u) => meeting.participants?.includes(u.id));
  const client       = meeting.clientId ? clients.find((c) => c.id === meeting.clientId) : null;
  const isPast       = meeting.status === 'completed';
  const isManager    = canManage(role);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'card p-5 border-l-[3px] transition-all',
        isPast && 'opacity-70'
      )}
      style={{ borderLeftColor: tc.color }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-[14.5px] font-bold text-slate-900 dark:text-white truncate">{meeting.title}</h3>
          {client && <p className="text-[12px] text-slate-500 mt-0.5">📎 {client.name}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="badge text-[10.5px]"
            style={{ background: tc.bg, color: tc.color }}
          >
            {tc.label}
          </span>
          <Badge variant={meeting.status === 'completed' ? 'success' : 'warning'}>
            {meeting.status}
          </Badge>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 mb-3 text-[12.5px] text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <Calendar size={12} className="text-slate-400 flex-shrink-0" />
          {meeting.date}
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={12} className="text-slate-400 flex-shrink-0" />
          {meeting.time} · {meeting.duration}
        </div>
        <div className="flex items-center gap-1.5 col-span-2">
          <MapPin size={12} className="text-slate-400 flex-shrink-0" />
          {meeting.location || '—'}
        </div>
      </div>

      {meeting.notes && (
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 mb-3 leading-relaxed">
          {meeting.notes}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <AvatarGroup users={participants} max={5} size="xs" />
        <div className="flex items-center gap-2">
          {meeting.meetingLink && !isPast && (
            <button
              className="btn-primary btn-sm"
              onClick={() => window.open(meeting.meetingLink, '_blank')}
            >
              <ExternalLink size={12} /> Join
            </button>
          )}
          {isManager && (
            <>
              <button
                className="btn-icon p-1.5 text-slate-400 hover:text-indigo-500"
                onClick={() => onEdit(meeting)}
                title="Edit"
              >
                <Edit size={13} />
              </button>
              <button
                className="btn-icon p-1.5 text-slate-400 hover:text-red-500"
                onClick={() => onDelete(meeting.id)}
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Meeting Form Modal ────────────────────────────────────────
function MeetingFormModal({ open, onClose, initialData, users, clients, onSave }) {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: initialData
      ? { ...initialData }
      : { type: 'internal', status: 'upcoming', duration: '60 min' },
  });

  const handleClose = () => { reset(); onClose(); };

  const onSubmit = (data) => {
    onSave({
      ...data,
      // participants: treat as array of IDs
      participants: users.map((u) => u.id), // all users by default; can be refined
      clientId:     data.clientId ? Number(data.clientId) : null,
    });
    handleClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={initialData ? 'Edit Meeting' : 'Schedule New Meeting'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)}>
            <Calendar size={14} /> {initialData ? 'Save Changes' : 'Schedule Meeting'}
          </Button>
        </>
      }
    >
      <div className="px-6 py-5 space-y-4">
        <Input
          label="Meeting Title *"
          placeholder="e.g. TechCorp Q1 Planning"
          error={errors.title?.message}
          {...register('title', { required: 'Title is required' })}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select label="Meeting Type" {...register('type')}>
            {Object.entries(MEETING_TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
          <Select label="Status" {...register('status')}>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
          </Select>
        </div>

        <Select label="Client (optional)" {...register('clientId')}>
          <option value="">None (Internal)</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>

        <div className="grid grid-cols-3 gap-4">
          <Input label="Date *" type="date" error={errors.date?.message} {...register('date', { required: 'Date is required' })} />
          <Input label="Time *" type="time" error={errors.time?.message} {...register('time', { required: 'Time is required' })} />
          <Select label="Duration" {...register('duration')}>
            {['15 min','30 min','45 min','60 min','90 min','120 min'].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </div>

        <Input
          label="Location / Platform"
          placeholder="Zoom, Google Meet, In-Person, Conference Room A…"
          {...register('location')}
        />

        <Input
          label="Meeting Link"
          placeholder="https://zoom.us/j/…"
          type="url"
          {...register('meetingLink')}
        />

        <Textarea
          label="Agenda / Notes"
          placeholder="What will be discussed in this meeting?"
          rows={3}
          {...register('notes')}
        />
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function MeetingsPage() {
  const { authUser, meetings, clients, addMeeting, updateMeeting, deleteMeeting } = useAppStore(useShallow((s) => ({
    authUser:       s.authUser,
    meetings:       s.meetings,
    clients:        s.clients,
    addMeeting:     s.addMeeting,
    updateMeeting:  s.updateMeeting,
    deleteMeeting:  s.deleteMeeting,
  })));
  const users = useAppStore((s) => s.users);

  const [tab,        setTab]        = useState('upcoming');
  const [showForm,   setShowForm]   = useState(false);
  const [editData,   setEditData]   = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const role      = authUser?.role;
  const isManager = canManage(role);

  const upcomingCount  = meetings.filter((m) => m.status === 'upcoming').length;
  const completedCount = meetings.filter((m) => m.status === 'completed').length;

  const filtered = meetings.filter((m) => m.status === tab);

  const handleSave = (data) => {
    if (editData) {
      updateMeeting(editData.id, data);
      toast.success('Meeting updated!');
    } else {
      addMeeting({ ...data, id: Date.now() });
      toast.success('Meeting scheduled!');
    }
    setEditData(null);
    setShowForm(false);
  };

  const handleEdit = (meeting) => {
    setEditData(meeting);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    deleteMeeting(id);
    toast.success('Meeting deleted.');
  };

  return (
    <Page>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">Meetings</h1>
          <p className="page-sub">
            {upcomingCount} upcoming · {completedCount} completed
          </p>
        </div>
        {isManager && (
          <Button variant="primary" size="sm" onClick={() => { setEditData(null); setShowForm(true); }}>
            <Plus size={14} /> Schedule Meeting
          </Button>
        )}
      </div>

      {/* Status tabs */}
      <Tabs
        tabs={[
          { value: 'upcoming',  label: 'Upcoming',  count: upcomingCount  },
          { value: 'completed', label: 'Completed', count: completedCount },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-5"
      />

      {/* Meetings grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Video}
          title={`No ${tab} meetings`}
          description={tab === 'upcoming'
            ? isManager ? 'Schedule a meeting using the button above.' : 'No meetings scheduled yet.'
            : 'No completed meetings yet.'
          }
          action={isManager && tab === 'upcoming' && (
            <Button variant="primary" size="sm" onClick={() => { setEditData(null); setShowForm(true); }}>
              <Plus size={13} /> Schedule Meeting
            </Button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence>
            {filtered.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                users={users}
                clients={clients}
                role={role}
                onEdit={handleEdit}
                onDelete={(id) => setConfirmDel(id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <MeetingFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditData(null); }}
        initialData={editData}
        users={users}
        clients={clients}
        onSave={handleSave}
      />
      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={() => { handleDelete(confirmDel); setConfirmDel(null); }}
        title="Delete Meeting"
        message="Remove this meeting permanently?"
        confirmLabel="Delete"
      />
    </Page>
  );
}
