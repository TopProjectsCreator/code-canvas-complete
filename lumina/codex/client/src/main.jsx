import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { useApp } from './store/useApp';
import { io } from 'socket.io-client';

const api = async (path, opts={}) => {
  const token = useApp.getState().token;
  const res = await fetch('http://localhost:4000'+path,{...opts,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})}});
  return res.json();
};

function Auth() { const setAuth=useApp(s=>s.setAuth); const [email,setE]=useState(''); const [password,setP]=useState(''); const [loading,setL]=useState(false);
  const submit=async(type)=>{setL(true);const r=await api(`/api/auth/${type}`,{method:'POST',body:JSON.stringify({email,password})});if(r.token)setAuth(r.token,r.user);setL(false)};
  return <div className='min-h-screen grid place-items-center text-white'><div className='card w-96 space-y-3'><h1 className='text-2xl'>Lumina</h1><input className='w-full p-2 bg-slate-800' placeholder='email' onChange={e=>setE(e.target.value)}/><input type='password' className='w-full p-2 bg-slate-800' placeholder='password' onChange={e=>setP(e.target.value)}/><div className='flex gap-2'><button disabled={loading} className='btn' onClick={()=>submit('signup')}>{loading?'...':'Signup'}</button><button disabled={loading} className='btn' onClick={()=>submit('login')}>Login</button></div></div></div>
}

function Dashboard(){ const user=useApp(s=>s.user); const [presence,setPresence]=useState(0); const [heat,setHeat]=useState(null); const [lessons,setLessons]=useState(null); const [sessionId,setSession]=useState(null); const [card,setCard]=useState(null);
 useEffect(()=>{const socket=io('http://localhost:4000'); socket.emit('zone:join',user?.id); socket.on('presence:update',d=>setPresence(d.inTheZone)); socket.on('heatmap:update',()=>loadHeat()); return ()=>socket.disconnect();},[]);
 const loadHeat=async()=>setHeat(await api('/api/sessions/heatmap')); const load=async()=>{setLessons(await api('/api/lessons')); loadHeat(); setCard(await api('/api/flashcards/due'));}; useEffect(()=>{load();},[]);
 if(!lessons||!heat) return <div className='p-8'><div className='skel h-8 w-80 mb-2'></div><div className='skel h-32 w-full'></div></div>;
 return <div className='p-6 text-white bg-slate-950 min-h-screen grid gap-4'>
 <div className='card'>Live Study Sidebar: <b>{presence}</b> in the zone</div>
 <div className='card'><h2 className='text-xl mb-2'>Focus Heatmap</h2><div className='grid grid-cols-7 gap-2'>{Array.from({length:14}).map((_,i)=>{const day=new Date(Date.now()-((13-i)*86400000)).toISOString().slice(0,10);const c=heat.find(h=>h.day===day)?.count||0;return <div key={day} className={`h-8 rounded ${c? 'bg-cyan-500':'bg-slate-800'}`} title={`${day}:${c}`}></div>;})}</div>{!sessionId?<button className='btn mt-3' onClick={async()=>setSession((await api('/api/sessions/start',{method:'POST'})).sessionId)}>Start Session</button>:<button className='btn mt-3' onClick={async()=>{await api(`/api/sessions/${sessionId}/end`,{method:'POST',body:JSON.stringify({focusScore:2})});setSession(null);loadHeat();}}>End Session</button>}</div>
 <div className='card'><h2>Lesson Player</h2>{lessons.map(l=><div key={l.id} className='my-2 p-2 bg-slate-800 rounded'><h3>{l.title}</h3><p>{l.markdown}</p><button className='btn mt-2' onClick={()=>api(`/api/lessons/${l.id}/complete`,{method:'POST'})}>Mark as Complete</button></div>)}</div>
 <div className='card'><h2>Active Recall</h2>{card? <div><p>{card.prompt}</p><button className='btn mr-2' onClick={async()=>{await api(`/api/flashcards/${card.id}/review`,{method:'POST',body:JSON.stringify({rating:'hard'})});setCard(await api('/api/flashcards/due'));}}>Hard</button><button className='btn' onClick={async()=>{await api(`/api/flashcards/${card.id}/review`,{method:'POST',body:JSON.stringify({rating:'easy'})});setCard(await api('/api/flashcards/due'));}}>Easy</button></div>:<FlashcardCreate onCreate={load}/>}</div>
 </div>
}
function FlashcardCreate({onCreate}){ const [prompt,setP]=useState(''); const [answer,setA]=useState(''); const [loading,setL]=useState(false); return <div className='space-y-2'><input className='w-full p-2 bg-slate-800' placeholder='Prompt' onChange={e=>setP(e.target.value)}/><input className='w-full p-2 bg-slate-800' placeholder='Answer' onChange={e=>setA(e.target.value)}/><button className='btn' disabled={loading} onClick={async()=>{setL(true);await api('/api/flashcards',{method:'POST',body:JSON.stringify({prompt,answer})});setL(false);onCreate();}}>{loading?'Creating...':'Create Card'}</button></div>}

function App(){ const token=useApp(s=>s.token); return token?<Dashboard/>:<Auth/>; }
createRoot(document.getElementById('root')).render(<App/>);
