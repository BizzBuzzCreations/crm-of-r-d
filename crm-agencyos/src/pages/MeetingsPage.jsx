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
import { cn, getId, sameId, MEETING_TYPE_CONFIG, canManage } from '../utils/helpers';

// ── Meeting Card ──────────────────────────────────────────────
function MeetingCard({ meeting, users, clients, role, onEdit, onDelete }) {
  const tc           = MEETING_TYPE_CONFIG[meeting.type] || MEETING_TYPE_CONFIG.internal;
  const participants = meeting.participants?.filter(p => p._id || p.id || p)?.map(p => typeof p==='object'?p:users.find(u=>sameId(u,p)))?.filter(Boolean) || [];
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
                onClick={() => onDelete(getId(meeting))}
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
      : { type: 'internal', status: 'upcoming', duration: '60 min', emergencyFlag: false },
  });

  const [selectedInvites, setSelectedInvites] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync state if initialData is provided
  useState(() => {
    if (initialData?.participants) {
      setSelectedInvites(initialData.participants.map(p => getId(p)));
    }
  }, [initialData]);

  const handleClose = () => { setSelectedInvites([]); setSearchQuery(''); reset(); onClose(); };

  const filteredMembers = users.filter(u => 
    (u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const onSubmit = (data) => {
    const startIso = data.date && data.time ? new Date(`${data.date}T${data.time}`).toISOString() : new Date().toISOString();
    const durMin = parseInt(data.duration) || 60;
    const endIso = new Date(new Date(startIso).getTime() + durMin * 60000).toISOString();

    onSave({
      ...data,
      startTime: startIso,
      endTime: endIso,
      invitedUserIds: selectedInvites,
      participants: selectedInvites,
      emergencyFlag: !!data.emergencyFlag,
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

        {/* Invite team members checkbox list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="block text-[12.5px] font-semibold text-slate-700 dark:text-slate-300">
              Invite Team Members *
            </label>
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  const allIds = filteredMembers.map(u => getId(u));
                  setSelectedInvites(Array.from(new Set([...selectedInvites, ...allIds])));
                }}
                className="btn-outline btn-xs !text-[11px] !px-2 !py-0.5"
              >
                Invite All
              </button>
              <button
                type="button"
                onClick={() => {
                  const filteredIds = filteredMembers.map(u => getId(u));
                  setSelectedInvites(selectedInvites.filter(id => !filteredIds.includes(id)));
                }}
                className="btn-outline btn-xs !text-[11px] !px-2 !py-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-800"
              >
                Clear All
              </button>
            </div>
          </div>
          
          <input
            type="text"
            placeholder="🔍 Search members by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input text-[12.5px] py-1 px-3 w-full border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
          />

          <div className="grid grid-cols-2 gap-2.5 max-h-[140px] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
            {filteredMembers.length === 0 ? (
              <p className="col-span-2 text-[12px] text-slate-400 text-center py-4">No matching team members found</p>
            ) : filteredMembers.map((u) => (
              <label key={getId(u)} className="flex items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 justify-between w-full p-1 rounded hover:bg-slate-100/50 dark:hover:bg-slate-700/30">
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    value={getId(u)}
                    checked={selectedInvites.includes(getId(u))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedInvites([...selectedInvites, getId(u)]);
                      } else {
                        setSelectedInvites(selectedInvites.filter(id => id !== getId(u)));
                      }
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 flex-shrink-0"
                  />
                  <span className="truncate" title={u.name}>{u.name}</span>
                </div>
                <span className={cn(
                  'text-[9.5px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0',
                  u.role === 'admin' && 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
                  u.role === 'manager' && 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
                  u.role === 'member' && 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                )}>
                  {u.role}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Forced Emergency Join */}
        <label className="flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-300 cursor-pointer font-semibold py-1.5">
          <input
            type="checkbox"
            {...register('emergencyFlag')}
            className="rounded text-red-600 focus:ring-red-500 border-red-300"
          />
          <span className="text-red-600 dark:text-red-400">🚨 Forced Corporate Emergency Join (Immediate RSVP Accept)</span>
        </label>

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
  const { authUser, meetings, clients, addMeeting, updateMeeting, deleteMeeting, mySchedule, submitRSVP } = useAppStore(useShallow((s) => ({
    authUser:       s.authUser,
    meetings:       s.meetings,
    clients:        s.clients,
    addMeeting:     s.addMeeting,
    updateMeeting:  s.updateMeeting,
    deleteMeeting:  s.deleteMeeting,
    mySchedule:     s.mySchedule,
    submitRSVP:     s.submitRSVP,
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

  const handleSave = async (data) => {
    try {
      if (editData) {
        await updateMeeting(getId(editData), data);
        toast.success('Meeting updated!');
      } else {
        await addMeeting(data);
        toast.success('Meeting scheduled!');
      }
      setEditData(null);
      setShowForm(false);
    } catch {}
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
          { value: 'invitations', label: 'Invitations & RSVPs', count: mySchedule.length },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-5"
      />

      {/* Meetings grid */}
      {tab === 'invitations' ? (
        mySchedule.length === 0 ? (
          <EmptyState
            icon={Video}
            title="No meeting invitations"
            description="You have not been invited to any meetings yet."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {mySchedule.map((item) => {
              const m = item.meeting;
              if (!m) return null;
              const tc = MEETING_TYPE_CONFIG[m.type] || MEETING_TYPE_CONFIG.internal;
              const createdByUser = users.find((u) => getId(u) === getId(m.createdBy));
              return (
                <div key={item.invitationId} className="card p-5 border-l-[3px] transition-all bg-white dark:bg-slate-800" style={{ borderLeftColor: tc.color }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-bold text-slate-900 dark:text-white truncate">{m.title}</h3>
                      {m.description && <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">{m.description}</p>}
                    </div>
                    <Badge variant={item.rsvpStatus === 'accepted' ? 'success' : item.rsvpStatus === 'declined' ? 'danger' : 'warning'}>
                      {item.rsvpStatus}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-y-1.5 mb-3 text-[12px] text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-slate-400 flex-shrink-0" />
                      <span>
                        {m.startTime ? new Date(m.startTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                      </span>
                    </div>
                    {m.emergencyFlag && (
                      <span className="badge text-[10px] bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 font-bold px-2 py-0.5 rounded w-max mt-1">
                        🚨 EMERGENCY JOIN REQUIRED
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4 border-t border-slate-100 dark:border-slate-700/50 pt-3">
                    <div className="flex items-center gap-2">
                      <Avatar user={createdByUser || { name: 'Manager', initials: 'M', color: '#6366f1' }} size="xs" />
                      <span className="text-[11.5px] text-slate-500">Created by {createdByUser?.name || 'Manager'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.rsvpStatus === 'pending' && (
                        <>
                          <button
                            className="btn-outline btn-xs px-2.5 py-1 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/10"
                            onClick={() => submitRSVP(item.invitationId, 'declined')}
                          >
                            Decline
                          </button>
                          <button
                            className="btn-primary btn-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => submitRSVP(item.invitationId, 'accepted')}
                          >
                            Accept
                          </button>
                        </>
                      )}
                      {item.rsvpStatus === 'accepted' && (
                        <button
                          className="btn-outline btn-xs px-2.5 py-1 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                          onClick={() => submitRSVP(item.invitationId, 'declined')}
                        >
                          Decline Meeting
                        </button>
                      )}
                      {item.rsvpStatus === 'declined' && (
                        <button
                          className="btn-outline btn-xs px-2.5 py-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/10"
                          onClick={() => submitRSVP(item.invitationId, 'accepted')}
                        >
                          Accept Meeting
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filtered.length === 0 ? (
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
                key={getId(m)}
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