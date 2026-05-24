import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hash, MessageCircle, Send, Trash2, Search, Paperclip,
  X, FileText, ImageIcon, Film, File, Download, Loader2,
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/shallow';
import { Page, Avatar } from '../components/ui';
import { messagesAPI } from '../services/api';
import { cn, getId, sameId } from '../utils/helpers';

// ── File helpers ──────────────────────────────────────────────
function fileIconCfg(type='') {
  if (type.startsWith('image/')) return { icon:ImageIcon, color:'#8b5cf6', bg:'#f5f3ff' };
  if (type.startsWith('video/')) return { icon:Film,      color:'#ef4444', bg:'#fef2f2' };
  if (type==='application/pdf')  return { icon:FileText,  color:'#ef4444', bg:'#fef2f2' };
  if (type.includes('sheet')||type.includes('csv')) return { icon:FileText, color:'#16a34a', bg:'#ecfdf5' };
  return { icon:File, color:'#6366f1', bg:'#eef2ff' };
}
function fmtSize(b) { if(b<1024) return `${b} B`; if(b<1048576) return `${(b/1024).toFixed(1)} KB`; return `${(b/1048576).toFixed(1)} MB`; }

function AttachmentPill({ att, onRemove }) {
  const { icon:Icon, color, bg } = fileIconCfg(att.type);
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[12px]">
      <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{background:bg}}><Icon size={12} style={{color}}/></div>
      <div className="min-w-0"><p className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[110px]">{att.name}</p><p className="text-[10.5px] text-slate-400">{fmtSize(att.size)}</p></div>
      <button onClick={onRemove} className="text-slate-400 hover:text-red-500 ml-1"><X size={12}/></button>
    </div>
  );
}

function AttachmentCard({ att, isMe }) {
  const { icon:Icon, color, bg } = fileIconCfg(att.type||'');
  const isImg = (att.type||'').startsWith('image/');
  const base  = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
  const url   = att.url?.startsWith('http') ? att.url : `${base}${att.url}`;
  return (
    <div className={cn('mt-1.5 rounded-xl overflow-hidden border max-w-[240px]', isMe?'border-white/20 bg-white/10':'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700')}>
      {isImg ? (
        <div><img src={url} alt={att.name} className="w-full max-h-[180px] object-cover cursor-pointer" onClick={()=>window.open(url,'_blank')}/>
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <span className={cn('text-[11px] truncate max-w-[150px]',isMe?'text-white/80':'text-slate-500')}>{att.name}</span>
            <a href={url} download={att.name} className={cn('ml-2',isMe?'text-white/70':'text-indigo-500')}><Download size={12}/></a>
          </div></div>
      ) : (
        <div className="flex items-center gap-2.5 p-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:isMe?'rgba(255,255,255,0.15)':bg}}><Icon size={15} style={{color:isMe?'#fff':color}}/></div>
          <div className="flex-1 min-w-0">
            <p className={cn('text-[12px] font-medium truncate',isMe?'text-white':'text-slate-700 dark:text-slate-300')}>{att.name}</p>
            <p className={cn('text-[10.5px]',isMe?'text-white/60':'text-slate-400')}>{fmtSize(att.size||0)}</p>
          </div>
          <a href={url} download={att.name} className={cn('flex-shrink-0',isMe?'text-white/70 hover:text-white':'text-indigo-500 hover:text-indigo-700')}><Download size={13}/></a>
        </div>
      )}
    </div>
  );
}

function TypingDots({ names }) {
  if (!names?.length) return null;
  return (
    <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="flex items-center gap-2 px-4 py-1.5 text-[12px] text-slate-400">
      <div className="flex gap-0.5">
        {[0,1,2].map((i)=>(
          <motion.span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full" animate={{y:[-2,2,-2]}} transition={{repeat:Infinity,delay:i*0.15,duration:0.6}}/>
        ))}
      </div>
      <span>{names.join(', ')} {names.length===1?'is':'are'} typing…</span>
    </motion.div>
  );
}

export default function MessagesPage() {
  const { authUser, messages, sendMessage, deleteMessage, loadThread, leaveThread, emitTypingStart, emitTypingStop } = useAppStore(useShallow((s) => ({
    authUser:       s.authUser,
    messages:       s.messages,
    sendMessage:    s.sendMessage,
    deleteMessage:  s.deleteMessage,
    loadThread:     s.loadThread,
    leaveThread:    s.leaveThread,
    emitTypingStart:s.emitTypingStart,
    emitTypingStop: s.emitTypingStop,
  })));
  const users = useAppStore((s) => s.users);

  const [activeThread,  setActiveThread]  = useState('general');
  const [localMsgs,     setLocalMsgs]     = useState([]);
  const [loadingMsgs,   setLoadingMsgs]   = useState(false);
  const [input,         setInput]         = useState('');
  const [search,        setSearch]        = useState('');
  const [hoveredMsg,    setHoveredMsg]    = useState(null);
  const [pendingFiles,  setPendingFiles]  = useState([]);
  const [sending,       setSending]       = useState(false);
  const [typingNames,   setTypingNames]   = useState([]);  // users typing in current thread
  const [onlineIds,     setOnlineIds]     = useState(new Set());

  const endRef      = useRef(null);
  const fileRef     = useRef(null);
  const textareaRef = useRef(null);
  const typingTimer = useRef(null);
  const prevThread  = useRef(null);

  // ── Socket typing / presence listeners ───────────────────
  useEffect(() => {
    const { onTypingStart, onTypingStop } = useAppStore.getState();
    const cleanStart = onTypingStart?.((data) => {
      if (data.threadId !== activeThread) return;
      const myId = getId(authUser);
      if (data.userId === myId) return;
      setTypingNames((prev) => prev.includes(data.name) ? prev : [...prev, data.name]);
    });
    const cleanStop = onTypingStop?.((data) => {
      if (data.threadId !== activeThread) return;
      setTypingNames((prev) => prev.filter((n) => n !== data.name));
    });
    return () => { cleanStart?.(); cleanStop?.(); };
  }, [activeThread, authUser]);

  // ── Messages from Zustand (socket pushed) ────────────────
  const storeThread = messages.threads[activeThread] || [];
  useEffect(() => {
    // Merge store thread with localMsgs (dedup by _id)
    const merged = [...storeThread];
    localMsgs.forEach((lm) => { if (!merged.some((m) => m._id === lm._id)) merged.push(lm); });
    merged.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
    // Only update if changed
    if (JSON.stringify(merged.map(m=>m._id)) !== JSON.stringify(storeThread.map(m=>m._id))) {
      setLocalMsgs(merged);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeThread]);

  // ── Load thread from API on switch ───────────────────────
  useEffect(() => {
    if (prevThread.current) leaveThread(prevThread.current);
    prevThread.current = activeThread;
    setTypingNames([]);
    setLocalMsgs([]);
    setLoadingMsgs(true);

    messagesAPI.getThread(activeThread)
      .then(({ data }) => setLocalMsgs(data.data || []))
      .catch(() => setLocalMsgs([]))
      .finally(() => setLoadingMsgs(false));

    // Tell socket to join this thread room
    loadThread(activeThread);
  }, [activeThread]);

  useEffect(() => {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
  }, [localMsgs]);

  // ── Derived ───────────────────────────────────────────────
  const isChannel    = messages.channels.some((c) => c.id === activeThread);
  const activeChannel= messages.channels.find((c) => c.id === activeThread);
  const activeDM     = messages.dms.find((d) => d.id === activeThread);
  const dmUser       = activeDM ? users.find((u) => getId(u) === String(activeDM.userId)) : null;
  const threadTitle  = isChannel ? `#${activeChannel?.name}` : dmUser?.name || 'Direct Message';
  const threadDesc   = isChannel ? activeChannel?.description : dmUser?.position;
  const statusColors = { online:'#10b981', away:'#f59e0b', offline:'#94a3b8' };
  const totalUnread  = [...messages.channels, ...messages.dms].reduce((a,c)=>a+(c.unread||0),0);

  // ── File input ────────────────────────────────────────────
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files||[]);
    setPendingFiles((prev) => [...prev, ...files.map((f) => ({ name:f.name, size:f.size, type:f.type, url:URL.createObjectURL(f), file:f }))]);
    e.target.value='';
  };
  const removePending = (idx) => setPendingFiles((prev) => { URL.revokeObjectURL(prev[idx].url); return prev.filter((_,i)=>i!==idx); });

  // ── Typing emission ───────────────────────────────────────
  const handleInputChange = (e) => {
    setInput(e.target.value);
    emitTypingStart(activeThread);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTypingStop(activeThread), 1500);
  };

  // ── Send (POST /api/messages/:threadId) ──────────────────
  const handleSend = async () => {
    if ((!input.trim() && pendingFiles.length===0) || sending) return;
    setSending(true);
    emitTypingStop(activeThread);
    try {
      let resp;
      if (pendingFiles.length > 0) {
        const fd = new FormData();
        if (input.trim()) fd.append('text', input.trim());
        pendingFiles.forEach((f) => f.file && fd.append('files', f.file));
        resp = await messagesAPI.sendFiles(activeThread, fd);
      } else {
        resp = await messagesAPI.send(activeThread, input.trim());
      }
      const newMsg = resp.data.data;
      setLocalMsgs((prev) => prev.some((m) => m._id===newMsg._id) ? prev : [...prev, newMsg]);
      setInput('');
      setPendingFiles([]);
      if (textareaRef.current) textareaRef.current.style.height='auto';
    } catch { /* toast handled in API layer */ }
    finally { setSending(false); }
  };

  // ── Delete (DELETE /api/messages/:id) ────────────────────
  const handleDelete = async (msgId) => {
    try {
      await messagesAPI.delete(msgId);
      setLocalMsgs((prev) => prev.filter((m) => m._id!==msgId));
    } catch {}
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <Page className="!p-0">
      <div className="flex h-[calc(100vh-3.5rem)] -m-6 overflow-hidden">

        {/* Sidebar */}
        <div className="w-60 bg-slate-900 flex flex-col flex-shrink-0 border-r border-slate-800">
          <div className="p-3 border-b border-slate-800">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/>
              <input placeholder="Search…" className="w-full bg-slate-800 text-slate-300 placeholder-slate-500 text-[12.5px] rounded-lg pl-7 pr-3 py-1.5 outline-none focus:bg-slate-700" value={search} onChange={(e)=>setSearch(e.target.value)}/>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
            {/* Channels */}
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Channels</div>
              {messages.channels.filter((c)=>!search||c.name.includes(search)).map((ch)=>(
                <button key={ch.id} onClick={()=>setActiveThread(ch.id)} className={cn('flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-[13px] transition-all',activeThread===ch.id?'bg-primary-500/20 text-primary-300':'text-slate-400 hover:bg-slate-800 hover:text-slate-300')}>
                  <Hash size={13} className="flex-shrink-0"/><span className="flex-1 truncate">{ch.name}</span>
                  {ch.unread>0&&<span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">{ch.unread}</span>}
                </button>
              ))}
            </div>
            {/* DMs */}
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Direct Messages</div>
              {messages.dms.map((dm)=>{
                const u = users.find((u)=>getId(u)===String(dm.userId));
                if (!u) return null;
                if (search&&!u.name.toLowerCase().includes(search.toLowerCase())) return null;
                const isOnline = u.status==='online';
                return (
                  <button key={dm.id} onClick={()=>setActiveThread(dm.id)} className={cn('flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-[13px] transition-all',activeThread===dm.id?'bg-primary-500/20 text-primary-300':'text-slate-400 hover:bg-slate-800 hover:text-slate-300')}>
                    <div className="relative flex-shrink-0"><Avatar user={u} size="xs"/><span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900" style={{background:statusColors[u.status]||'#94a3b8'}}/></div>
                    <span className="flex-1 truncate">{u.name.split(' ')[0]}</span>
                    {dm.unread>0&&<span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">{dm.unread}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Socket status */}
          <div className="px-3 py-2 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
              <span>Live · Socket.io connected</span>
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="flex flex-col flex-1 bg-white dark:bg-slate-900 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              {isChannel
                ? <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center"><Hash size={15} className="text-indigo-600 dark:text-indigo-400"/></div>
                : <div className="relative"><Avatar user={dmUser} size="sm"/><span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900" style={{background:statusColors[dmUser?.status]||'#94a3b8'}}/></div>
              }
              <div>
                <p className="text-[14px] font-semibold text-slate-900 dark:text-white">{threadTitle}</p>
                <p className="text-[11.5px] text-slate-500">{threadDesc}</p>
              </div>
            </div>
            <div className="text-[12px] text-slate-400">{localMsgs.length} messages</div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loadingMsgs ? (
              <div className="flex items-center justify-center h-full gap-2 text-slate-400">
                <Loader2 size={18} className="animate-spin"/><span className="text-[13px]">Loading messages…</span>
              </div>
            ) : localMsgs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <MessageCircle size={36} className="mb-3 opacity-30"/>
                <p className="text-[14px] font-semibold">No messages yet</p>
                <p className="text-[12px] mt-0.5">Start the conversation!</p>
              </div>
            ) : (() => {
              let lastDate = null;
              return localMsgs.map((msg, i) => {
                const senderObj = msg.userId && typeof msg.userId === 'object' ? msg.userId : null;
                const senderId  = getId(msg.userId);
                const myId      = getId(authUser);
                const isMe      = senderId === myId;
                const sender    = senderObj || users.find((u) => getId(u) === senderId);
                const prevSender= i > 0 ? getId(localMsgs[i-1]?.userId) : null;
                const isFirst   = prevSender !== senderId;
                const msgDate   = msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : 'Today';
                const showDate  = msgDate !== lastDate; lastDate = msgDate;
                const msgTime   = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : msg.time || '';
                const hasAtts   = msg.attachments?.length > 0;
                return (
                  <div key={msg._id || i}>
                    {showDate && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"/>
                        <span className="text-[11.5px] text-slate-400 font-medium">{msgDate}</span>
                        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"/>
                      </div>
                    )}
                    <motion.div initial={{opacity:0,y:3}} animate={{opacity:1,y:0}} className={cn('flex gap-3 group px-1 py-0.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors',isMe?'flex-row-reverse':'')} onMouseEnter={()=>setHoveredMsg(msg._id)} onMouseLeave={()=>setHoveredMsg(null)}>
                      {isFirst && !isMe && <Avatar user={sender} size="sm" className="mt-1 flex-shrink-0"/>}
                      {!isFirst && !isMe && <div className="w-8 flex-shrink-0"/>}
                      <div className={cn('flex flex-col max-w-sm lg:max-w-md',isMe?'items-end':'')}>
                        {isFirst && (
                          <div className={cn('flex items-center gap-2 mb-1',isMe?'flex-row-reverse':'')}>
                            <span className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-300">{sender?.name?.split(' ')[0]||'User'}</span>
                            <span className="text-[11px] text-slate-400">{msgTime}</span>
                          </div>
                        )}
                        {msg.text && <div className={cn(isMe?'msg-bubble-out':'msg-bubble-in')}>{msg.text}</div>}
                        {hasAtts && (
                          <div className={cn('flex flex-col gap-1',isMe?'items-end':'items-start')}>
                            {msg.attachments.map((a,ai)=><AttachmentCard key={ai} att={a} isMe={isMe}/>)}
                          </div>
                        )}
                      </div>
                      <AnimatePresence>
                        {hoveredMsg===msg._id && (isMe||authUser?.role==='admin') && (
                          <motion.button initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} exit={{opacity:0}} onClick={()=>handleDelete(msg._id)} className="self-start mt-1 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0">
                            <Trash2 size={12}/>
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                );
              });
            })()}
            <AnimatePresence>
              {typingNames.length > 0 && <TypingDots names={typingNames}/>}
            </AnimatePresence>
            <div ref={endRef}/>
          </div>

          {/* Input */}
          <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
            <AnimatePresence>
              {pendingFiles.length > 0 && (
                <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="flex gap-2 flex-wrap mb-2.5 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="w-full flex items-center justify-between mb-1">
                    <span className="text-[11.5px] font-semibold text-slate-500 uppercase tracking-wide">{pendingFiles.length} file{pendingFiles.length>1?'s':''} attached</span>
                    <button onClick={()=>{pendingFiles.forEach((f)=>URL.revokeObjectURL(f.url));setPendingFiles([]);}} className="text-[11.5px] text-red-500 font-medium">Remove all</button>
                  </div>
                  {pendingFiles.map((f,i)=><AttachmentPill key={i} att={f} onRemove={()=>removePending(i)}/>)}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-end gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5">
              <button onClick={()=>fileRef.current?.click()} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all mb-0.5" title="Attach file (max 10MB)">
                <Paperclip size={16}/>
              </button>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileChange} accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"/>

              <textarea ref={textareaRef} rows={1}
                className="flex-1 bg-transparent outline-none text-[13.5px] text-slate-800 dark:text-slate-200 placeholder-slate-400 resize-none max-h-[120px] py-0.5"
                placeholder={`Message ${threadTitle}…`}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e)=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();} }}
                onBlur={()=>emitTypingStop(activeThread)}
              />

              <button onClick={handleSend} disabled={(!input.trim()&&pendingFiles.length===0)||sending}
                className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all mb-0.5',(input.trim()||pendingFiles.length>0)&&!sending?'bg-primary-500 text-white hover:bg-primary-600':'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed')}>
                {sending ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 pl-1 flex items-center gap-3">
              <span>Enter to send · Shift+Enter for new line</span>
              <span className="flex items-center gap-1"><Paperclip size={10}/> Click 📎 to attach files</span>
            </p>
          </div>
        </div>
      </div>
    </Page>
  );
}