import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, Check, ChevronRight, Crown, Hash, Loader2, Lock, Megaphone, MessageCircle, Plus, Send, Settings, Trash2, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, PageContainer } from '@/components/shared/common';
import { ApiError } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { chatService } from '@/services/chatService';
import { useTravellerStore } from '@/store/useTravellerStore';
import type { Chat, ChatAccess, ChatMessage } from '@/types/chat';
import { applyPollVote, composerModes, dayLabel, mergeMessages, messageTime, pollPercent, validatePoll } from './chatLogic';
import type { ComposerMode } from './chatLogic';
import '@/features/groups/groups.css';
import './chat.css';

const POLL_MS = 4000;
const MAX_MESSAGE = 2000;

/* ---------- messages ---------- */

function MessageMeta({ message }: { message: ChatMessage }) {
  return (
    <span className="ct-meta">
      <span className="ct-id" title="Message ID">{message.message_id}</span>
      <time dateTime={message.created_at}>{messageTime(message.created_at)}</time>
    </span>
  );
}

function Sender({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <span className="ct-sender">
      {mine ? 'You' : message.sender.name}
      {message.sender.is_owner ? <span className="ct-owner-tag"><Crown size={11} aria-hidden="true" />Organiser</span> : null}
    </span>
  );
}

function PollCard({ message, onVote, busy }: { message: ChatMessage; onVote: (optionId: number) => void; busy: boolean }) {
  const poll = message.poll!;
  return (
    <fieldset className="ct-poll" aria-describedby={`${message.message_id}-total`}>
      <legend><BarChart3 size={16} aria-hidden="true" />{message.content}</legend>
      <div className="ct-poll-options">
        {poll.options.map((o) => {
          const pct = pollPercent(poll, o.votes);
          const chosen = poll.my_option_id === o.option_id;
          return (
            <button key={o.option_id} type="button" className={`ct-option ${chosen ? 'is-chosen' : ''}`} aria-pressed={chosen} disabled={busy}
              onClick={() => onVote(o.option_id)} aria-label={`${o.label}: ${o.votes} vote${o.votes === 1 ? '' : 's'}, ${pct}%${chosen ? ', your vote' : ''}`}>
              <span className="ct-option-bar" style={{ width: `${pct}%` }} aria-hidden="true" />
              <span className="ct-option-label">{chosen ? <Check size={14} aria-hidden="true" /> : null}{o.label}</span>
              <span className="ct-option-pct" aria-hidden="true">{pct}%</span>
            </button>
          );
        })}
      </div>
      <p id={`${message.message_id}-total`} className="ct-poll-total">
        {poll.total_votes} vote{poll.total_votes === 1 ? '' : 's'}{poll.my_option_id ? ' · tap another option to change your vote' : ' · tap an option to vote'}
      </p>
    </fieldset>
  );
}

function MessageItem({ message, mine, onVote, voting }: { message: ChatMessage; mine: boolean; onVote: (m: ChatMessage, optionId: number) => void; voting: boolean }) {
  if (message.type === 'ANNOUNCEMENT') {
    return (
      <li className="ct-row ct-row--wide">
        <article className="ct-announcement" aria-label={`Announcement from ${message.sender.name}`}>
          <header><Megaphone size={16} aria-hidden="true" /><strong>Announcement</strong><Sender message={message} mine={mine} /></header>
          <p>{message.content}</p>
          <MessageMeta message={message} />
        </article>
      </li>
    );
  }
  if (message.type === 'POLL') {
    return (
      <li className="ct-row ct-row--wide">
        <article className="ct-poll-wrap" aria-label={`Poll from ${message.sender.name}`}>
          <header><Sender message={message} mine={mine} /><span className="ct-kind">Poll</span></header>
          <PollCard message={message} busy={voting} onVote={(id) => onVote(message, id)} />
          <MessageMeta message={message} />
        </article>
      </li>
    );
  }
  return (
    <li className={`ct-row ${mine ? 'is-mine' : ''}`}>
      {!mine ? <span className="avatar small" aria-hidden="true">{message.sender.name.charAt(0)}</span> : null}
      <article className="ct-bubble" aria-label={`Message from ${mine ? 'you' : message.sender.name}`}>
        <Sender message={message} mine={mine} />
        <p>{message.content}</p>
        <MessageMeta message={message} />
      </article>
    </li>
  );
}

/* ---------- composer ---------- */

function Composer({ chat, onSent }: { chat: Chat; onSent: (m: ChatMessage) => void }) {
  const modes = composerModes(chat.my_permissions);
  const firstAllowed = modes.find((m) => m.allowed)?.mode ?? 'TEXT';
  const [mode, setMode] = useState<ComposerMode>(firstAllowed);
  const [text, setText] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const current = modes.find((m) => m.mode === mode)!;

  // If the organiser changes the settings, fall back to a tab this traveller can still use.
  useEffect(() => { if (!current.allowed && firstAllowed !== mode) setMode(firstAllowed); }, [current.allowed, firstAllowed, mode]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!current.allowed || pending) return;
    if (!useTravellerStore.getState().ensureValidSession()) return;
    setError('');
    if (mode === 'POLL') {
      const invalid = validatePoll(question, options);
      if (invalid) { setError(invalid); return; }
    } else if (!text.trim()) return;
    setPending(true);
    try {
      const sent = mode === 'POLL'
        ? await chatService.createPoll(chat.group_id, { question: question.trim(), options: options.map((o) => o.trim()).filter(Boolean) })
        : await chatService.sendMessage(chat.group_id, text.trim(), mode);
      onSent(sent);
      if (mode === 'POLL') { setQuestion(''); setOptions(['', '']); setMode(firstAllowed === 'POLL' ? 'POLL' : firstAllowed); } else setText('');
    } catch (err) {
      setError(err instanceof ApiError && Object.values(err.fields)[0] ? Object.values(err.fields)[0] : err instanceof Error ? err.message : 'Could not send. Please try again.');
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); }
  }

  if (!modes.some((m) => m.allowed)) {
    return <p className="ct-readonly" role="note"><Lock size={15} aria-hidden="true" />Only the organiser can post in this chat right now. You can still vote in polls.</p>;
  }

  return (
    <form className="ct-composer" onSubmit={submit} aria-label="Write to the team">
      <div className="ct-tabs" role="tablist" aria-label="What do you want to post?">
        {modes.map((m) => (
          <button key={m.mode} type="button" role="tab" aria-selected={mode === m.mode} disabled={!m.allowed} title={m.reason || undefined}
            className="ct-tab" onClick={() => { setMode(m.mode); setError(''); }}>
            {m.mode === 'TEXT' ? <MessageCircle size={14} aria-hidden="true" /> : m.mode === 'ANNOUNCEMENT' ? <Megaphone size={14} aria-hidden="true" /> : <BarChart3 size={14} aria-hidden="true" />}
            {m.label}{!m.allowed ? <Lock size={11} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>

      {mode === 'POLL' ? (
        <div className="ct-poll-form">
          <label className="sr-only" htmlFor="poll-question">Poll question</label>
          <Input id="poll-question" placeholder="Ask the group… e.g. Which day for the day trip?" value={question} maxLength={300} onChange={(e) => setQuestion(e.target.value)} />
          {options.map((o, i) => (
            <div key={i} className="ct-poll-option-row">
              <label className="sr-only" htmlFor={`poll-option-${i}`}>Option {i + 1}</label>
              <Input id={`poll-option-${i}`} placeholder={`Option ${i + 1}`} value={o} maxLength={100} onChange={(e) => setOptions((all) => all.map((x, j) => (j === i ? e.target.value : x)))} />
              {options.length > 2 ? (
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove option ${i + 1}`} onClick={() => setOptions((all) => all.filter((_, j) => j !== i))}><Trash2 size={15} aria-hidden="true" /></Button>
              ) : null}
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" disabled={options.length >= 6} onClick={() => setOptions((all) => [...all, ''])}><Plus size={14} aria-hidden="true" />Add option</Button>
            <Button type="submit" disabled={pending}>{pending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <BarChart3 size={15} aria-hidden="true" />}Create poll</Button>
          </div>
        </div>
      ) : (
        <div className={`ct-input-row ${mode === 'ANNOUNCEMENT' ? 'is-announcement' : ''}`}>
          <label className="sr-only" htmlFor="chat-input">{mode === 'ANNOUNCEMENT' ? 'Announcement' : 'Message'}</label>
          <textarea id="chat-input" className="ct-textarea" rows={2} maxLength={MAX_MESSAGE} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown}
            placeholder={mode === 'ANNOUNCEMENT' ? 'Announce something to everyone (pinned style)…' : 'Message the team… (Enter to send, Shift+Enter for a new line)'} />
          <Button type="submit" disabled={pending || !text.trim()} aria-label={mode === 'ANNOUNCEMENT' ? 'Post announcement' : 'Send message'}>
            {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : mode === 'ANNOUNCEMENT' ? <Megaphone size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
          </Button>
        </div>
      )}
      <div className="ct-composer-foot">
        {error ? <p role="alert" className="field-error">{error}</p> : <span />}
        {mode !== 'POLL' ? <small aria-live="polite">{text.length}/{MAX_MESSAGE}</small> : null}
      </div>
    </form>
  );
}

/* ---------- group settings (owner) ---------- */

const ACCESS_OPTIONS: { value: ChatAccess; label: string }[] = [
  { value: 'ALL_MEMBERS', label: 'All members' },
  { value: 'OWNER_ONLY', label: 'Only the organiser' },
];

function SettingsDialog({ chat, open, onClose, onSaved }: { chat: Chat; open: boolean; onClose: () => void; onSaved: (c: Chat) => void }) {
  const [messaging, setMessaging] = useState(chat.settings.messaging);
  const [polls, setPolls] = useState(chat.settings.polls);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setMessaging(chat.settings.messaging); setPolls(chat.settings.polls); setError(''); } }, [open, chat.settings]);

  async function save() {
    setPending(true);
    setError('');
    try {
      onSaved(await chatService.updateSettings(chat.group_id, { messaging, polls }));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the settings.');
    } finally {
      setPending(false);
    }
  }

  const group = (name: string, legend: string, value: ChatAccess, set: (v: ChatAccess) => void) => (
    <fieldset className="ct-setting">
      <legend>{legend}</legend>
      {ACCESS_OPTIONS.map((o) => (
        <label key={o.value} className="ct-radio">
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => set(o.value)} />
          {o.label}
        </label>
      ))}
    </fieldset>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !pending) onClose(); }} title="Group settings"
      description="Choose who can post in the team chat. You (the organiser) can always message, post announcements and create polls.">
      {group('messaging', 'Who can send messages', messaging, setMessaging)}
      {group('polls', 'Who can create polls', polls, setPolls)}
      <p className="field-hint">Announcements are always organiser-only. Everyone can vote in polls.</p>
      {error ? <p role="alert" className="field-error mt-2">{error}</p> : null}
      <div className="flex flex-wrap gap-3 mt-4">
        <Button variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
        <Button disabled={pending} onClick={save}>{pending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}Save settings</Button>
      </div>
    </Dialog>
  );
}

/* ---------- chat view ---------- */

function ChatView({ initialChat }: { initialChat: Chat }) {
  const me = useTravellerStore((s) => s.travellerId);
  const [chat, setChat] = useState(initialChat);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [syncError, setSyncError] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const stickToBottom = useRef(true);
  const votingRef = useRef(false);
  const groupId = chat.group_id;

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try { setMessages(await chatService.listMessages(groupId)); } catch (err) { setLoadError(err instanceof Error ? err.message : 'Could not load messages.'); } finally { setLoading(false); }
  }, [groupId]);
  useEffect(() => { void loadFirst(); }, [loadFirst]);

  // Poll the latest page (new messages *and* updated poll counts) and permission changes while the tab is visible.
  useEffect(() => {
    if (loading || loadError) return;
    const tick = async () => {
      if (document.hidden || votingRef.current) return; // don't overwrite an optimistic vote mid-request
      try {
        const [fresh, latestChat] = await Promise.all([chatService.listMessages(groupId), chatService.getChat(groupId)]);
        setMessages((all) => mergeMessages(all, fresh));
        setChat(latestChat);
        setSyncError(false);
      } catch { setSyncError(true); }
    };
    const timer = window.setInterval(() => { void tick(); }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [groupId, loading, loadError]);

  // Keep the newest message in view unless the user scrolled up to read older ones.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function vote(message: ChatMessage, optionId: number) {
    if (!message.poll || message.poll.my_option_id === optionId) return;
    const before = message;
    setVoting(message.message_id);
    votingRef.current = true;
    setMessages((all) => all.map((m) => (m.message_id === message.message_id ? { ...m, poll: applyPollVote(m.poll!, optionId) } : m)));
    try {
      const saved = await chatService.vote(groupId, message.message_id, optionId);
      setMessages((all) => mergeMessages(all, [saved]));
    } catch {
      setMessages((all) => mergeMessages(all, [before])); // roll back the optimistic vote
      setSyncError(true);
    } finally {
      setVoting(null);
      votingRef.current = false;
    }
  }

  let lastDay = '';
  return (
    <>
      <header className="card ct-header gp-rise">
        <span className="ct-header-icon" aria-hidden="true"><UsersRound size={22} /></span>
        <div className="min-w-0">
          <h1>{chat.group_name}</h1>
          <p className="ct-header-sub">
            <span className="ct-chip" title="Chat ID"><Hash size={12} aria-hidden="true" />{chat.chat_id}</span>
            <span>{chat.members.length} member{chat.members.length === 1 ? '' : 's'}: {chat.members.map((m) => (m.traveller_id === me ? 'You' : m.name.split(' ')[0])).join(', ')}</span>
          </p>
          <p className="ct-header-access">
            Messages: <b>{chat.settings.messaging === 'ALL_MEMBERS' ? 'all members' : 'organiser only'}</b> · Polls: <b>{chat.settings.polls === 'ALL_MEMBERS' ? 'all members' : 'organiser only'}</b>
          </p>
        </div>
        {chat.my_permissions.can_manage ? (
          <Button variant="outline" className="ml-auto" onClick={() => setSettingsOpen(true)}><Settings size={15} aria-hidden="true" />Group settings</Button>
        ) : null}
      </header>

      <section className="card ct-panel" aria-label="Team chat">
        {syncError ? <p className="ct-sync" role="status">Connection problem. Retrying…</p> : null}
        {loading ? (
          <div className="ct-empty" role="status"><Loader2 className="animate-spin" aria-hidden="true" />Loading messages…</div>
        ) : loadError ? (
          <div className="ct-empty" role="alert">{loadError} <Button variant="outline" size="sm" onClick={loadFirst}>Retry</Button></div>
        ) : !messages.length ? (
          <div className="ct-empty">
            <MessageCircle size={28} aria-hidden="true" />
            <strong>Say hello to your travel group</strong>
            <span>Plan the itinerary, agree on times with a poll, or post an announcement.</span>
          </div>
        ) : (
          <ol className="ct-list" ref={listRef} aria-live="polite" aria-label="Messages"
            onScroll={(e) => { const el = e.currentTarget; stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
            {messages.map((m) => {
              const day = dayLabel(m.created_at);
              const separator = day !== lastDay ? <li key={`day-${m.message_id}`} className="ct-day" role="separator"><span>{day}</span></li> : null;
              lastDay = day;
              return [separator, <MessageItem key={m.message_id} message={m} mine={m.sender.traveller_id === me} voting={voting === m.message_id} onVote={vote} />];
            })}
          </ol>
        )}
        <Composer chat={chat} onSent={(m) => { stickToBottom.current = true; setMessages((all) => mergeMessages(all, [m])); }} />
      </section>

      <SettingsDialog chat={chat} open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={setChat} />
    </>
  );
}

/* ---------- page ---------- */

export default function GroupChatPage() {
  const { groupId = '' } = useParams();
  const me = useTravellerStore((s) => s.travellerId);
  const query = useAsync(() => chatService.getChat(groupId), `chat:${groupId}:${me ?? '-'}`);
  const status = query.error instanceof ApiError ? query.error.status : 0;
  const back = <Link className="text-link" to={`/groups/${groupId}`}>Back to the group</Link>;

  return (
    <PageContainer className="gp-page ct-page">
      <nav className="gp-breadcrumb" aria-label="Breadcrumb">
        <Link to="/my-groups">My groups</Link><ChevronRight size={12} aria-hidden="true" />
        <Link to={`/groups/${groupId}`}>{query.data?.group_name ?? groupId}</Link><ChevronRight size={12} aria-hidden="true" />
        <span>Team chat</span>
      </nav>
      <Link to={`/groups/${groupId}`} className="text-link ct-back"><ArrowLeft size={14} aria-hidden="true" />Back to the group</Link>
      {query.loading ? <div className="gp-skel" style={{ height: 420 }} role="status" aria-label="Loading chat" />
        : status === 409 ? <EmptyState title="The team chat isn’t open yet" action={back}><p>{query.error!.message}. Finalise a hotel together on the group page first.</p></EmptyState>
        : status === 403 ? <EmptyState title="Members only" action={back}><p>{query.error!.message}.</p></EmptyState>
        : status === 404 ? <EmptyState title="Group not found" action={<Link className="text-link" to="/my-groups">Back to my groups</Link>}><p>There is no group with ID {groupId}.</p></EmptyState>
        : query.error || !query.data ? <ErrorState error={query.error} retry={query.retry} />
        : <ChatView key={query.data.chat_id} initialChat={query.data} />}
    </PageContainer>
  );
}
