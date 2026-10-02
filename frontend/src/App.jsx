import { useCallback, useEffect, useRef, useState } from 'react';

const API = '/api', OWNER = 'owner-1', FOLLOWER = 'viewer-1';
const AUD = { PUBLIC: 'Everyone', FOLLOWERS: 'Followers', CLOSE_FRIENDS: 'Close Friends' };
const SCENES = ['Sunset', 'City', 'Ocean', 'Forest', 'Desert'];

const seen = new Set();
async function call(path, opts = {}) {
  const t = performance.now();
  // Only send a JSON content-type when there is a body; Fastify rejects an empty JSON body with 400.
  const r = await fetch(API + path, { ...opts, headers: opts.body ? { 'content-type': 'application/json' } : {} });
  if (r.status >= 500) throw new Error('API ' + r.status);
  return { j: await r.json(), ms: Math.round(performance.now() - t) };
}
const seed = () => { const n = Date.now(); return ['Golden hour', 'Night out', 'Beach day', 'Trail run', 'Road trip'].map((title, i) => ({ id: 'local-' + i, ownerId: OWNER, title, audience: Object.keys(AUD)[i % 3], status: 'ACTIVE', createdAt: n, expiresAt: n + 90000 + i * 45000, archiveEnabled: true })); };
const frac = (s, now) => Math.max(0, Math.min(1, (s.expiresAt - now) / (s.expiresAt - s.createdAt)));
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const hash = (id) => [...id].reduce((a, c) => a + c.charCodeAt(0), 0);

// Illustrated story media. It desaturates and darkens as the story nears its end.
function Scene({ k, f = 1 }) {
  const g = `g${k}`;
  const art = [
    <><defs><linearGradient id={g} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2b1055" /><stop offset=".55" stopColor="#d4418e" /><stop offset="1" stopColor="#ffb36b" /></linearGradient></defs><rect width="360" height="640" fill={`url(#${g})`} /><circle cx="180" cy="360" r="70" fill="#ffe3a3" /><path d="M0 470l80-90 70 70 90-120 120 140v170H0z" fill="#3a1659" /><path d="M0 540l100-70 90 60 80-50 90 60v100H0z" fill="#1d0b33" /></>,
    <><defs><linearGradient id={g} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f0c29" /><stop offset="1" stopColor="#4a3a9c" /></linearGradient></defs><rect width="360" height="640" fill={`url(#${g})`} /><circle cx="270" cy="130" r="38" fill="#f4f1ff" /><g fill="#0b0920">{[[10, 400, 50, 240], [70, 340, 60, 300], [140, 430, 45, 210], [195, 300, 70, 340], [275, 390, 85, 250]].map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} />)}</g><g fill="#ffd36b">{Array.from({ length: 28 }, (_, i) => <rect key={i} x={20 + (i % 7) * 48} y={360 + Math.floor(i / 7) * 60} width="8" height="12" opacity={i % 3 ? 0.9 : 0.2} />)}</g></>,
    <><defs><linearGradient id={g} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbd786" /><stop offset="1" stopColor="#f7797d" /></linearGradient></defs><rect width="360" height="640" fill={`url(#${g})`} /><circle cx="180" cy="330" r="60" fill="#fff4d6" /><rect y="380" width="360" height="260" fill="#16406b" /><g fill="#fff4d6" opacity=".7">{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={180 - 50 + i * 6} y={395 + i * 24} width={100 - i * 12} height="6" rx="3" />)}</g></>,
    <><defs><linearGradient id={g} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#134e5e" /><stop offset="1" stopColor="#71b280" /></linearGradient></defs><rect width="360" height="640" fill={`url(#${g})`} /><circle cx="90" cy="150" r="34" fill="#e9ffd0" opacity=".85" />{[[40, 560, 1.3], [130, 580, 1.6], [230, 550, 1.4], [310, 590, 1.2]].map(([x, y, s], i) => <path key={i} d={`M${x} ${y}l${-40 * s} 0 ${40 * s} ${-170 * s} ${40 * s} ${170 * s}z`} fill={i % 2 ? '#0b3a2e' : '#06281f'} />)}</>,
    <><defs><linearGradient id={g} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff8a00" /><stop offset="1" stopColor="#e52e71" /></linearGradient></defs><rect width="360" height="640" fill={`url(#${g})`} /><circle cx="250" cy="300" r="46" fill="#fff0b8" /><path d="M0 460c80-50 160-40 240 0s90 30 120 10v170H0z" fill="#8a2a4a" /><path d="M0 540c100-40 200-30 360 10v90H0z" fill="#4a1230" /></>
  ][k % 5];
  return <svg viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block', filter: `saturate(${0.25 + 0.75 * f}) brightness(${0.8 + 0.2 * f})`, transition: 'filter 1s linear' }} aria-hidden>{art}</svg>;
}

function Ring({ s, k, now, size = 68, viewed = false }) {
  const f = frac(s, now), r = size / 2 - 3, c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E3E3E8" strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" strokeLinecap="round" stroke={f < 0.1 ? '#FFB020' : viewed ? '#C7C7CC' : s.audience === 'CLOSE_FRIENDS' ? '#1DB954' : 'url(#ig)'} strokeDasharray={`${c * f} ${c}`} />
      </svg>
      <div className="circ" style={{ position: 'absolute', inset: 6 }}><Scene k={k} f={f} /></div>
    </div>
  );
}

const Ic = ({ d }) => <svg viewBox="0 0 24 24" aria-hidden><path d={d} /></svg>;
const ICONS = { home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z', plus: 'M12 5v14M5 12h14', archive: 'M3 7h18v4H3zM5 11v9h14v-9M10 15h4', pulse: 'M3 12h4l3-8 4 16 3-8h4' };

function StoryCard({ s, k, now, onClick }) {
  const f = frac(s, now), gone = s.status !== 'ACTIVE';
  return (
    <button className="card" onClick={onClick} aria-label={`${s.title}, ${gone ? 'archived' : fmt(s.expiresAt - now) + ' left'}`}>
      <Scene k={k} f={gone ? 0 : f} />
      <div className="life" aria-hidden><i style={{ width: `${gone ? 0 : f * 100}%` }} /></div>
      <div className="ov">
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{s.title}</div>
        <span className={`pill ${!gone && f < 0.1 ? 'w' : ''}`}>{gone ? 'Archived' : `Fades in ${fmt(s.expiresAt - now)}`}</span>
      </div>
    </button>
  );
}

function Faded({ owner, onBack }) {
  return (
    <div className="faded"><div>
      <div className="logo" style={{ fontSize: 40 }}>Faded</div>
      <h2 style={{ margin: '8px 0', fontSize: 20 }}>This story is no longer available</h2>
      <p style={{ color: 'var(--mu)', margin: '0 0 20px' }}>{owner ? 'It is saved in your Archive.' : 'Stories disappear after 24 hours (2 minutes in demo mode).'}</p>
      <button className="btn g" onClick={onBack}>Back to home</button>
    </div></div>
  );
}

function Viewer({ s, k, now, role, offline, onClose, onNav, onDelete }) {
  const [st, setSt] = useState('loading'), [stats, setStats] = useState(null), [sheet, setSheet] = useState(false), [vs, setVs] = useState([]);
  const uid = role === 'owner' ? OWNER : FOLLOWER;
  useEffect(() => {
    let live = true;
    (async () => {
      if (offline) return live && setSt(s.status === 'ACTIVE' || role === 'owner' ? 'ok' : 'gone');
      const { j } = await call(`/stories/${s.id}?viewerId=${uid}&isOwner=${role === 'owner'}`);
      if (!live) return;
      setSt(j.status === 200 ? 'ok' : 'gone');
      const key = s.id + uid; if (j.status === 200 && role !== 'owner' && !seen.has(key)) { seen.add(key); call(`/stories/${s.id}/view`, { method: 'POST', body: JSON.stringify({ viewerId: uid }) }); }
    })().catch(() => live && setSt('ok'));
    return () => { live = false; };
  }, [s.id, role, offline]);
  useEffect(() => {
    if (role !== 'owner' || offline) return;
    const p = () => call(`/stories/${s.id}/stats`).then(({ j }) => setStats(j.summary)).catch(() => {});
    p(); const t = setInterval(p, 1500); return () => clearInterval(t);
  }, [s.id, role, offline]);
  useEffect(() => { if (sheet && !offline) call(`/stories/${s.id}/viewers?limit=30`).then(({ j }) => setVs(j.items || [])).catch(() => {}); }, [sheet, stats?.uniqueViewers]);
  useEffect(() => { const h = (e) => { if (!onNav) return; if (e.key === 'ArrowRight') onNav(1); if (e.key === 'ArrowLeft') onNav(-1); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onNav]);
  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);
  const f = frac(s, now), expired = s.status !== 'ACTIVE' || now >= s.expiresAt;
  const gone = st === 'gone' || (expired && role !== 'owner');
  const openSheet = () => setSheet(true);
  return (
    <div className="ovl" onClick={onClose}>
      <div className="vw" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={s.title}>
        <div style={{ position: 'absolute', inset: 0 }}><Scene k={k} f={expired ? 0 : f} /></div>
        {onNav && <><button className="tap l" aria-label="Previous story" onClick={() => onNav(-1)} /><button className="tap r" aria-label="Next story" onClick={() => onNav(1)} /></>}
        <div className="top">
          <div style={{ height: 3, borderRadius: 2, background: '#fff4' }}><div style={{ height: '100%', width: `${f * 100}%`, background: f < 0.1 ? 'var(--amber)' : '#fff', borderRadius: 2, transition: 'width .5s linear' }} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <div className="circ" style={{ width: 34, height: 34 }}><Scene k={k} f={1} /></div>
            <b style={{ fontSize: 14 }}>{role === 'owner' ? 'You' : 'dusk.owner'}</b>
            <span className={`pill ${f < 0.1 && !expired ? 'w' : ''}`}>{expired ? 'In your Archive' : `Fades in ${fmt(s.expiresAt - now)}`}</span>
            <button onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', fontSize: 28, minWidth: 44, minHeight: 44 }}>×</button>
          </div>
        </div>
        <div className="bot">
          {role === 'owner'
            ? <><span className="pill">{AUD[s.audience]}</span>{!expired && <button className="btn g" onClick={onDelete}>Delete</button>}<button className="btn g" style={{ marginLeft: 'auto' }} onClick={openSheet}>Seen by {stats ? stats.uniqueViewers : '–'}</button></>
            : <><input className="inp" placeholder={sent ? 'Message sent ✓' : 'Send message'} aria-label="Send message" value={rep} onChange={(e) => setRep(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && rep.trim()) { setRep(''); setSent(true); setTimeout(() => setSent(false), 2000); } }} style={{ borderRadius: 99, background: '#0008' }} /><button aria-label={liked ? 'Unlike' : 'Like'} aria-pressed={liked} onClick={() => setLiked(!liked)} style={{ fontSize: 26, minWidth: 44, minHeight: 44, color: liked ? '#FF3B5C' : '#fff' }}>{liked ? '♥' : '♡'}</button></>}
        </div>
        {sheet && <div className="sheet" role="dialog" aria-label="Viewers">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ margin: 0, fontSize: 18 }}>{stats ? stats.totalPlays : 0} plays · {stats ? stats.uniqueViewers : 0} viewers</h3><button onClick={() => setSheet(false)} aria-label="Close viewers" style={{ fontSize: 26, minWidth: 44, minHeight: 44 }}>×</button></div>
          <p style={{ color: 'var(--mu)', fontSize: 13, margin: '0 0 10px' }}>Counts update live and settle after expiry.</p>
          {vs.length === 0 && <p style={{ color: 'var(--mu)' }}>No viewers yet. Switch to Follower and open this story.</p>}
          {vs.map((v) => <div key={v} className="vrow"><i style={{ background: `hsl(${hash(v) % 360} 60% 55%)` }}>{v[0].toUpperCase()}</i><b>{v}</b></div>)}
        </div>}
        {gone && <Faded owner={false} onBack={onClose} />}
      </div>
    </div>
  );
}

function CreateModal({ onShare, onClose, ttl }) {
  const life = ttl >= 3600 ? `${Math.round(ttl / 3600)} hours` : ttl >= 60 ? `${Math.round(ttl / 60)} minutes` : `${ttl} seconds`;
  const [title, setTitle] = useState(''), [aud, setAud] = useState('PUBLIC'), [arch, setArch] = useState(true), [k, setK] = useState(0);
  return (
    <div className="ovl" onClick={onClose}><div className="mod" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="New story">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ margin: 0, fontSize: 18 }}>New story</h2><button onClick={onClose} aria-label="Close" style={{ fontSize: 26, minWidth: 44, minHeight: 44 }}>×</button></div>
      <div className="pick" role="group" aria-label="Pick a photo">{SCENES.map((n, i) => <button key={n} aria-pressed={k === i} aria-label={n} onClick={() => setK(i)}><Scene k={i} /></button>)}</div>
      <input className="inp" placeholder="Add a title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
      <div className="seg" role="group" aria-label="Audience">{Object.entries(AUD).map(([a, v]) => <button key={a} aria-pressed={aud === a} onClick={() => setAud(a)}>{v}</button>)}</div>
      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 44 }}><span>Save to Archive<br /><small style={{ color: 'var(--mu)' }}>Only you can see it after it fades</small></span><input type="checkbox" checked={arch} onChange={(e) => setArch(e.target.checked)} style={{ width: 22, height: 22, accentColor: '#0095F6' }} /></label>
      <button className="btn" onClick={() => onShare({ title: title || SCENES[k], audience: aud, archiveEnabled: arch }, k)}>Share to story</button>
      <small style={{ color: 'var(--mu)' }}>{`Fades for everyone else in ${life}.`}{ttl < 86400 ? ' Demo mode: real apps use 24 hours.' : ''}</small>
    </div></div>
  );
}

function Console({ list, now, summary, ms, offline, refresh }) {
  const [target, setTarget] = useState(''), [n, setN] = useState(200), [res, setRes] = useState(null), [busy, setBusy] = useState(false);
  const active = list.filter((s) => s.status === 'ACTIVE'), overdue = active.filter((s) => s.expiresAt < now).length, pick = active.find((s) => s.id === target)?.id || active[0]?.id;
  const chaos = async (a) => { try { if (!offline) await call(`/admin/chaos/${a}`, { method: 'POST' }); } catch { /* shown by the offline banner on next poll */ } refresh(a); };
  const load = async () => {
    if (!pick || offline) return; setBusy(true); const t0 = performance.now();
    try {
    await Promise.all(Array.from({ length: n }, (_, i) => call(`/stories/${pick}/view`, { method: 'POST', body: JSON.stringify({ viewerId: `load-${i % Math.ceil(n / 2)}` }) })));
    const { j } = await call(`/stories/${pick}/stats`); setRes({ ...j.summary, sent: n, ms: Math.round(performance.now() - t0) });
    } catch { setRes(null); } finally { setBusy(false); }
  };
  const rows = (a) => a.map(([k, v]) => <div className="kv" key={k}><span>{k}</span><b>{v}</b></div>);
  return (<>
    <div className="panel"><h3>System <span className={`pill ${offline ? 'w' : 'ok'}`}>{offline ? 'Offline preview' : 'Live'}</span></h3>
      {rows([['Active', summary.ACTIVE ?? active.length], ['Archived', summary.ARCHIVED ?? 0], ['Purged', summary.PURGED ?? 0], ['Active past expiry', overdue], ['Next expiry in', active.length ? fmt(Math.min(...active.map((x) => x.expiresAt)) - now) : '–'], ['API round trip', offline ? '–' : `${ms} ms`]])}</div>
    <div className="panel"><h3>Break things</h3><div style={{ display: 'grid', gap: 8 }}>
      <button className="btn r" onClick={() => chaos('expire-now')}>Expire all active stories now</button>
      <button className="btn g" onClick={() => chaos('reset')}>Reset demo (restore stories)</button>
      <button className="btn g" onClick={() => chaos('flush-redis')}>Flush Redis</button>
      <button className="btn g" onClick={() => chaos('delay-queue')}>Delay queue</button></div></div>
    <div className="panel"><h3>Load test</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <select className="inp" value={pick || ''} onChange={(e) => setTarget(e.target.value)} aria-label="Story" style={{ flex: 1 }}>{active.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
        <input className="inp" type="number" min="10" max="2000" value={n} onChange={(e) => setN(Math.min(2000, Math.max(1, Math.round(+e.target.value) || 1)))} aria-label="Views" style={{ width: 84 }} /></div>
      <button className="btn" style={{ width: '100%' }} disabled={busy || offline || !pick} onClick={load}>{busy ? 'Sending…' : `Send ${n} views`}</button>
      {res && <div style={{ marginTop: 8 }}>{rows([['Requests', res.sent], ['Total plays', res.totalPlays], ['Unique viewers', res.uniqueViewers], ['Exact viewers', res.exactViewers], ['Time', `${res.ms} ms`]])}</div>}
      {offline && <p style={{ color: 'var(--mu)', fontSize: 13 }}>Start the backend to run this.</p>}</div>
  </>);
}

export default function App() {
  const [role, setRole] = useState('owner'), [tab, setTab] = useState('home'), [create, setCreate] = useState(false);
  const [remote, setRemote] = useState([]), [local, setLocal] = useState(seed), [offline, setOffline] = useState(false);
  const [summary, setSummary] = useState({}), [ms, setMs] = useState(0), [hl, setHl] = useState([]), [now, setNow] = useState(Date.now());
  const seq = useRef(0), [viewed, setViewed] = useState(() => new Set()), [ttl, setTtl] = useState(120), [openId, setOpenId] = useState(null), [openS, setOpenS] = useState(null), [toast, setToast] = useState(''), [scenes, setScenes] = useState({});
  const uid = role === 'owner' ? OWNER : FOLLOWER;
  const note = (t) => { setToast(t); setTimeout(() => setToast(''), 2200); };
  const guard = (fn) => async (...a) => { try { await fn(...a); } catch { note('Something went wrong. Is the backend running?'); } };
  const kOf = (s) => s.scene ?? scenes[s.id] ?? hash(s.id) % 5;
  useEffect(() => { call('/health').then(({ j }) => j.ttlSeconds && setTtl(j.ttlSeconds)).catch(() => {}); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const refresh = useCallback(async () => {
    const my = ++seq.current;
    try {
      const [tray, m, h] = await Promise.all([call(`/stories/tray?ownerId=${uid}`), call('/metrics'), call(`/highlights/${OWNER}`)]);
      if (my !== seq.current) return;
      if (!Array.isArray(tray.j.stories)) throw new Error('bad');
      setRemote(tray.j.stories); setSummary(m.j.summary || {}); setMs(tray.ms); setHl(h.j.items || []); setOffline(false);
    } catch { setOffline(true); }
  }, [uid]);
  useEffect(() => { refresh(); const t = setInterval(refresh, 2000); return () => clearInterval(t); }, [refresh]);
  const derive = (a) => a.map((s) => s.status === 'ACTIVE' && now >= s.expiresAt ? { ...s, status: s.archiveEnabled ? 'ARCHIVED' : 'PURGED' } : s);
  const list = offline ? derive(local).filter((s) => role === 'owner' || (s.status === 'ACTIVE' && s.audience === 'PUBLIC')) : derive(remote);
  const active = list.filter((s) => s.status === 'ACTIVE'), archived = list.filter((s) => s.ownerId === OWNER && s.status === 'ARCHIVED');
  const open = openId ? (list.find((s) => s.id === openId) ?? openS) : null;
  const openStory = (s) => { setOpenId(s.id); setOpenS(s); if (role === 'follower') setViewed((v) => new Set(v).add(s.id)); };
  const idx = active.findIndex((x) => x.id === openId);
  const go = (d) => { const n = active[idx + d]; if (n) openStory(n); else if (d > 0) setOpenId(null); };
  const del = guard(async (st) => {
    if (offline) setLocal((l) => l.map((x) => x.id === st.id ? { ...x, status: 'PURGED' } : x));
    else { await call(`/stories/${st.id}?ownerId=${OWNER}`, { method: 'DELETE' }); await refresh(); }
    setOpenId(null); note('Story deleted');
  });

  const share = async (b, k) => {
    let id = 'local-' + Date.now();
    if (offline) { const n = Date.now(); setLocal((l) => [{ id, ownerId: OWNER, status: 'ACTIVE', createdAt: n, expiresAt: n + 120000, ...b }, ...l]); }
    else { const { j } = await call('/stories', { method: 'POST', body: JSON.stringify({ ownerId: OWNER, scene: k, ...b }) }); id = j.story?.id || id; await refresh(); }
    setScenes((m) => ({ ...m, [id]: k })); setCreate(false); setTab('home'); note('Shared to your story');
  };
  const purge = async (s) => { if (offline) setLocal((l) => l.map((x) => x.id === s.id ? { ...x, status: 'PURGED' } : x)); else { await call(`/archive/${s.id}?ownerId=${OWNER}`, { method: 'DELETE' }); await refresh(); } note('Deleted forever'); };
  const addHl = async (s) => {
    if (hl.some((h) => h.stories?.includes(s.id))) return note('Already in Highlights');
    if (offline) setHl((h) => [...h, { id: s.id, title: s.title, stories: [s.id] }]);
    else { const { j } = await call('/highlights', { method: 'POST', body: JSON.stringify({ ownerId: OWNER, title: s.title }) }); await call(`/highlights/${j.item.id}/items`, { method: 'POST', body: JSON.stringify({ storyId: s.id }) }); await refresh(); }
    note('Added to Highlights');
  };
  const chaosLocal = (a) => { if (offline && a === 'reset') setLocal(seed()); if (offline && a === 'expire-now') setLocal((l) => l.map((s) => ({ ...s, expiresAt: Date.now() - 1 }))); };
  const roleSeg = <div className="seg" role="group" aria-label="Viewing as"><button aria-pressed={role === 'owner'} onClick={() => setRole('owner')}>Owner</button><button aria-pressed={role === 'follower'} onClick={() => setRole('follower')}>Follower</button></div>;
  const nav = [['home', 'Home', 'home'], ['archive', 'Archive', 'archive']];

  return (
    <div className="app">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden><defs><linearGradient id="ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#FFD36B" /><stop offset=".25" stopColor="#FF9A3C" /><stop offset=".5" stopColor="#FF5E62" /><stop offset=".75" stopColor="#C2358F" /><stop offset="1" stopColor="#7B4BD6" /></linearGradient></defs></svg>
      <nav className="side" aria-label="Main">
        <div className="logo"><i className="sun" aria-hidden />Dusk</div>
        {nav.map(([k, l, i]) => <button key={k} className="nv" aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}><Ic d={ICONS[i]} /><span className="t">{l}</span></button>)}
        <button className="nv cta" disabled={role !== 'owner'} title={role !== 'owner' ? 'Switch to Owner to post a story' : undefined} onClick={() => setCreate(true)} style={{ opacity: role === 'owner' ? 1 : 0.4 }}><Ic d={ICONS.plus} /><span className="t">New story</span></button>
        <button className="nv only-sm" aria-current={tab === 'console' ? 'page' : undefined} onClick={() => setTab('console')}><Ic d={ICONS.pulse} /><span className="t">Demo tools</span></button>
      </nav>
      <div className="body">
      <main className="main">
        <header className="topbar"><h1 className="pg">{{ home: 'Stories', archive: 'Archive', console: 'Demo tools' }[tab]}</h1><div className="vas"><span>Viewing as</span>{roleSeg}</div></header>
        {offline && <div className="warn" role="alert">Can't reach the API, so you're seeing an offline preview. Start the backend to use live data.</div>}
        {tab === 'home' && <>
          <div className="tray" role="list">
            {active.length === 0 && <p style={{ color: 'var(--mu)', margin: 0 }}>No active stories. {role === 'owner' ? 'Tap Create to share one.' : 'Switch to Owner to post one.'}</p>}
            {role === 'owner' && <button className="tr" role="listitem" onClick={() => setCreate(true)}><span className="add"><Ic d={ICONS.plus} /></span><span>Add story</span></button>}
            {active.map((s) => <button key={s.id} className="tr" role="listitem" onClick={() => openStory(s)}><Ring s={s} k={kOf(s)} now={now} viewed={viewed.has(s.id)} /><span>{s.title.slice(0, 11)}</span><small className="tl">{fmt(s.expiresAt - now)}</small></button>)}
          </div>
          <h2 className="h">{role === 'owner' ? 'Posted in the last 24 hours' : 'From dusk.owner'}</h2>
          <div className="grid">{(role === 'owner' ? list.filter((s) => s.ownerId === OWNER && s.status !== 'PURGED') : active).map((s) => <StoryCard key={s.id} s={s} k={kOf(s)} now={now} onClick={() => openStory(s)} />)}</div>
        </>}
        {tab === 'archive' && (role !== 'owner' ? <p style={{ color: 'var(--mu)' }}>Archive is private. Switch to Owner to see it.</p> : <>
          <h2 className="h">Highlights</h2>
          <div className="tray">{hl.length === 0 && <p style={{ color: 'var(--mu)', margin: 0 }}>No Highlights yet. Add one from a story below.</p>}
            {hl.map((h) => <div key={h.id} className="tr"><div className="circ" style={{ width: 68, height: 68, border: '2px solid #E3E3E8' }}><Scene k={kOf(list.find((x) => x.id === h.stories?.[0]) || { id: h.id })} /></div><span>{h.title.slice(0, 11)}</span></div>)}</div>
          <h2 className="h">Archive <span style={{ color: 'var(--mu)', fontWeight: 400, fontSize: 14 }}>Only you can see these</span></h2>
          {archived.length === 0 && <p style={{ color: 'var(--mu)' }}>Nothing here yet. Stories land here when they fade.</p>}
          <div className="grid">{archived.map((s) => <div key={s.id}><StoryCard s={s} k={kOf(s)} now={now} onClick={() => openStory(s)} />
            <div style={{ display: 'grid', gap: 6, marginTop: 6 }}><button className="btn g" onClick={() => guard(addHl)(s)}>Add to Highlight</button><button className="btn r" onClick={() => guard(purge)(s)}>Delete forever</button></div></div>)}</div>
        </>)}
        {tab === 'console' && <Console list={list} now={now} summary={summary} ms={ms} offline={offline} refresh={(a) => { chaosLocal(a); refresh(); }} />}
      </main>
      <aside className="rail" aria-label="Demo tools"><details open><summary>Demo tools</summary><Console list={list} now={now} summary={summary} ms={ms} offline={offline} refresh={(a) => { chaosLocal(a); refresh(); }} /></details></aside>
      </div>
      {open && <Viewer key={open.id + role} s={open} k={kOf(open)} now={now} role={role} offline={offline} onClose={() => setOpenId(null)} onNav={idx >= 0 ? go : null} onDelete={() => del(open)} />}
      {create && <CreateModal ttl={ttl} onShare={guard(share)} onClose={() => setCreate(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
