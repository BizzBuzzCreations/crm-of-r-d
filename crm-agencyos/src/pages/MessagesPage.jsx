import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, MessageCircle, Send, Trash2, Search, Paperclip, X, FileText, ImageIcon, Film, File, Download } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/shallow';
import { Page, Avatar } from '../components/ui';
import { cn } from '../utils/helpers';

function fileIconCfg(type = '') {
  if (type.startsWith('image/')) return { icon: ImageIcon, color: '#8b5cf6', bg: '#f5f3ff' };
  if (type.startsWith('video/')) return { icon: Film,      color: '#ef4444', bg: '#fef2f2' };
  if (type === 'application/pdf') return { icon: FileText,  color: '#ef4444', bg: '#fef2f2' };
  if (type.includes('sheet') || type.includes('csv')) return { icon: FileText, color: '#16a34a', bg: '#ecfdf5' };
  return { icon: File, color: '#6366f1', bg: '#eef2ff' };
}
function fmtSize(b) { if(b<1024) return `${b} B`; if(b<1048576) return `${(b/1024).toFixed(1)} KB`; return `${(b/1048576).toFixed(1)} MB`; }

function AttachmentPill({ att, onRemove }) {
  const { icon: Icon, color, bg } = fileIconCfg(att.type);
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[12px]">
      <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: bg }}><Icon size={12} style={{ color }} /></div>
      <div className="min-w-0"><p className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[110px]">{att.name}</p><p className="text-[10.5px] text-slate-400">{fmtSize(att.size)}</p></div>
      <button onClick={onRemove} className="text-slate-400 hover:text-red-500 ml-1"><X size={12} /></button>
    </div>
  );
}

function AttachmentCard({ att, isMe }) {
  const { icon: Icon, color, bg } = fileIconCfg(att.type || '');
  const isImg = att.type?.startsWith('image/');
  return (
    <div className={cn('mt-1.5 rounded-xl overflow-hidden border max-w-[240px]', isMe ? 'border-white/20 bg-white/10' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700')}>
      {isImg && att.url ? (
        <div><img src={att.url} alt={att.name} className="w-full max-h-[180px] object-cover" />
          <div className="flex items-center justify-between px-2.5 py-1.5"><span className={cn('text-[11px] truncate max-w-[150px]', isMe ? 'text-white/80' : 'text-slate-500')}>{att.name}</span>
            <a href={att.url} download={att.name} className={cn('ml-2 flex-shrink-0', isMe ? 'text-white/70' : 'text-indigo-500')}><Download size={12} /></a></div></div>
      ) : (
        <div className="flex items-center gap-2.5 p-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: isMe ? 'rgba(255,255,255,0.15)' : bg }}><Icon size={15} style={{ color: isMe ? '#fff' : color }} /></div>
          <div className="flex-1 min-w-0"><p className={cn('text-[12px] font-medium truncate', isMe ? 'text-white' : 'text-slate-700 dark:text-slate-300')}>{att.name}</p><p className={cn('text-[10.5px]', isMe ? 'text-white/60' : 'text-slate-400')}>{fmtSize(att.size||0)}</p></div>
          {att.url && <a href={att.url} download={att.name} className={cn('flex-shrink-0', isMe ? 'text-white/70 hover:text-white' : 'text-indigo-500 hover:text-indigo-700')}><Download size={13} /></a>}
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  const { authUser, messages, sendMessage, deleteMessage } = useAppStore(useShallow((s) => ({
    authUser: s.authUser, messages: s.messages, sendMessage: s.sendMessage, deleteMessage: s.deleteMessage,
  })));
  const users = useAppStore((s) => s.users);

  const [activeThread, setActiveThread] = useState('general');
  const [input, setInput]               = useState('');
  const [search, setSearch]             = useState('');
  const [hoveredMsg, setHoveredMsg]     = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const endRef     = useRef(null);
  const fileRef    = useRef(null);
  const textareaRef= useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeThread, messages.threads]);

  const isChannel    = messages.channels.some((c) => c.id === activeThread);
  const activeChannel= messages.channels.find((c) => c.id === activeThread);
  const activeDM     = messages.dms.find((d) => d.id === activeThread);
  const dmUser       = activeDM ? users.find((u) => u.id === activeDM.userId) : null;
  const threadTitle  = isChannel ? `#${activeChannel?.name}` : dmUser?.name || 'Direct Message';
  const threadDesc   = isChannel ? activeChannel?.description : dmUser?.position;
  const threadMsgs   = messages.threads[activeThread] || [];
  const totalUnread  = [...messages.channels, ...messages.dms].reduce((a,c) => a+(c.unread||0), 0);
  const statusColors = { online:'#10b981', away:'#f59e0b', offline:'#94a3b8' };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPendingFiles((prev) => [...prev, ...files.map((f) => ({ name:f.name, size:f.size, type:f.type, url:URL.createObjectURL(f), file:f }))]);
    e.target.value = '';
  };
  const removePending = (idx) => setPendingFiles((prev) => { URL.revokeObjectURL(prev[idx].url); return prev.filter((_,i)=>i!==idx); });

  const handleSend = () => {
    if (!input.trim() && pendingFiles.length === 0) return;
    const atts = pendingFiles.map(({ name,size,type,url }) => ({ name,size,type,url }));
    sendMessage(activeThread, input.trim(), atts);
    setInput(''); setPendingFiles([]);
    if (textareaRef.current) textareaRef.current.style.height='auto';
  };

  return (
    <Page className="!p-0">
      <div className="flex h-[calc(100vh-3.5rem)] -m-6 overflow-hidden">
        {/* Sidebar */}
        <div className="w-60 bg-slate-900 flex flex-col flex-shrink-0 border-r border-slate-800">
          <div className="p-3 border-b border-slate-800">
            <div className="relative"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input placeholder="Search…" className="w-full bg-slate-800 text-slate-300 placeholder-slate-500 text-[12.5px] rounded-lg pl-7 pr-3 py-1.5 outline-none focus:bg-slate-700" value={search} onChange={(e)=>setSearch(e.target.value)} /></div>
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Channels</div>
              {messages.channels.filter((c)=>!search||c.name.includes(search)).map((ch)=>(
                <button key={ch.id} onClick={()=>setActiveThread(ch.id)} className={cn('flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-[13px] transition-all', activeThread===ch.id?'bg-primary-500/20 text-primary-300':'text-slate-400 hover:bg-slate-800 hover:text-slate-300')}>
                  <Hash size={13} className="flex-shrink-0" /><span className="flex-1 truncate">{ch.name}</span>
                  {ch.unread>0&&<span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">{ch.unread}</span>}
                </button>
              ))}
            </div>
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Direct Messages</div>
              {messages.dms.map((dm)=>{
                const u=users.find((u)=>u.id===dm.userId);
                if(!u||u.id===authUser?.id) return null;
                if(search&&!u.name.toLowerCase().includes(search.toLowerCase())) return null;
                return (
                  <button key={dm.id} onClick={()=>setActiveThread(dm.id)} className={cn('flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-[13px] transition-all', activeThread===dm.id?'bg-primary-500/20 text-primary-300':'text-slate-400 hover:bg-slate-800 hover:text-slate-300')}>
                    <div className="relative flex-shrink-0"><Avatar user={u} size="xs" /><span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900" style={{background:statusColors[u.status]||'#94a3b8'}} /></div>
                    <span className="flex-1 truncate">{u.name.split(' ')[0]}</span>
                    {dm.unread>0&&<span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">{dm.unread}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="flex flex-col flex-1 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              {isChannel ? <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center"><Hash size={15} className="text-indigo-600 dark:text-indigo-400" /></div> : <Avatar user={dmUser} size="sm" showStatus />}
              <div><p className="text-[14px] font-semibold text-slate-900 dark:text-white">{threadTitle}</p><p className="text-[11.5px] text-slate-500">{threadDesc}</p></div>
            </div>
            <span className="text-[12px] text-slate-400">{threadMsgs.length} messages</span>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
            {threadMsgs.length===0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <MessageCircle size={36} className="mb-3 opacity-30" />
                <p className="text-[14px] font-semibold">No messages yet</p>
                <p className="text-[12px] mt-0.5">Start the conversation!</p>
              </div>
            ) : (() => {
              let lastDate=null;
              return threadMsgs.map((msg,i)=>{
                const sender=users.find((u)=>u.id===msg.userId);
                const isMe=msg.userId===authUser?.id;
                const isFirst=i===0||threadMsgs[i-1]?.userId!==msg.userId;
                const showDate=msg.date!==lastDate; lastDate=msg.date;
                const hasAtts=msg.attachments?.length>0;
                return (
                  <div key={msg.id}>
                    {showDate&&<div className="flex items-center gap-3 my-4"><div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"/><span className="text-[11.5px] text-slate-400 font-medium">{msg.date}</span><div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"/></div>}
                    <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} className={cn('flex gap-3 group px-1 py-0.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',isMe?'flex-row-reverse':'')} onMouseEnter={()=>setHoveredMsg(msg.id)} onMouseLeave={()=>setHoveredMsg(null)}>
                      {isFirst&&!isMe&&<Avatar user={sender} size="sm" className="mt-1 flex-shrink-0"/>}
                      {!isFirst&&!isMe&&<div className="w-8 flex-shrink-0"/>}
                      <div className={cn('flex flex-col max-w-sm lg:max-w-md',isMe?'items-end':'')}>
                        {isFirst&&<div className={cn('flex items-center gap-2 mb-1',isMe?'flex-row-reverse':'')}><span className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-300">{sender?.name?.split(' ')[0]||'User'}</span><span className="text-[11px] text-slate-400">{msg.time}</span></div>}
                        {msg.text&&<div className={cn(isMe?'msg-bubble-out':'msg-bubble-in')}>{msg.text}</div>}
                        {hasAtts&&<div className={cn('flex flex-col gap-1',isMe?'items-end':'items-start')}>{msg.attachments.map((a,ai)=><AttachmentCard key={ai} att={a} isMe={isMe}/>)}</div>}
                      </div>
                      <AnimatePresence>
                        {hoveredMsg===msg.id&&(isMe||authUser?.role==='admin')&&(
                          <motion.button initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} exit={{opacity:0}} onClick={()=>deleteMessage(activeThread,msg.id)} className="self-start mt-1 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"><Trash2 size={12}/></motion.button>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                );
              });
            })()}
            <div ref={endRef}/>
          </div>

          <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
            <AnimatePresence>
              {pendingFiles.length>0&&(
                <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="flex gap-2 flex-wrap mb-2.5 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="w-full flex items-center justify-between mb-1"><span className="text-[11.5px] font-semibold text-slate-500 uppercase tracking-wide">{pendingFiles.length} file{pendingFiles.length>1?'s':''} ready</span><button onClick={()=>{pendingFiles.forEach((f)=>URL.revokeObjectURL(f.url));setPendingFiles([]);}} className="text-[11.5px] text-red-500 font-medium">Remove all</button></div>
                  {pendingFiles.map((f,i)=><AttachmentPill key={i} att={f} onRemove={()=>removePending(i)}/>)}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex items-end gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5">
              <button onClick={()=>fileRef.current?.click()} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all mb-0.5" title="Attach file"><Paperclip size={16}/></button>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileChange} accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"/>
              <textarea ref={textareaRef} rows={1} className="flex-1 bg-transparent outline-none text-[13.5px] text-slate-800 dark:text-slate-200 placeholder-slate-400 resize-none max-h-[120px] py-0.5" placeholder={`Message ${threadTitle}…`} value={input}
                onChange={(e)=>{setInput(e.target.value);e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px';}}
                onKeyDown={(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();}}} />
              <button onClick={handleSend} disabled={!input.trim()&&pendingFiles.length===0} className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all mb-0.5',(input.trim()||pendingFiles.length>0)?'bg-primary-500 text-white hover:bg-primary-600':'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed')}><Send size={14}/></button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 pl-1 flex items-center gap-3"><span>Enter to send · Shift+Enter for new line</span><span className="flex items-center gap-1"><Paperclip size={10}/> Click 📎 to attach</span></p>
          </div>
        </div>
      </div>
    </Page>
  );
}
