import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import debounce from 'lodash.debounce';
import { io } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';

const API = 'http://localhost:3001';
const NOTE_COLORS = ['#ffffff', '#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3'];

function RichEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight: createLowlight() }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  return <EditorContent editor={editor} className="rounded border bg-white p-4 min-h-[60vh]" />;
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);

  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState('');
  const [tagInput, setTagInput] = useState('');

  const client = useMemo(() => axios.create({
    baseURL: API,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }), [token]);

  const activeNote = notes.find((n) => n.id === activeId);

  useEffect(() => {
    if (!token) return;
    client.get('/notes').then(({ data }) => {
      setNotes(data);
      if (data[0]) {
        setActiveId(data[0].id);
      }
    }).catch(() => {
      toast.error('Failed to load notes');
    });
  }, [token, client]);

  useEffect(() => {
    if (!token) return;
    const userId = JSON.parse(atob(token.split('.')[1])).id;
    const socket = io(API, { auth: { userId } });

    socket.on('note:created', (note) => setNotes((prev) => [note, ...prev]));
    socket.on('note:updated', (note) => {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
    });
    socket.on('note:deleted', (id) => setNotes((prev) => prev.filter((n) => n.id !== id)));

    return () => socket.disconnect();
  }, [token]);

  const saveNote = useMemo(() => debounce(async (id, payload) => {
    try {
      await client.put(`/notes/${id}`, payload);
    } catch {
      toast.error('Autosave failed');
    }
  }, 600), [client]);

  const setDraft = (patch) => {
    setNotes((prev) => prev.map((n) => (n.id === activeId ? { ...n, ...patch } : n)));
    if (activeNote) {
      saveNote(activeNote.id, { ...activeNote, ...patch });
    }
  };

  const submitAuth = async (mode) => {
    setAuthLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/${mode}`, authForm);
      localStorage.setItem('token', data.token);
      setToken(data.token);
      toast.success(mode === 'signup' ? 'Account created' : 'Welcome back');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const createNote = async () => {
    const { data } = await client.post('/notes', {
      title: 'Untitled note',
      content: '<p></p>',
      tags: [],
      color: '#ffffff',
    });
    setActiveId(data.id);
    toast.success('Note created');
  };

  const deleteNote = async () => {
    if (!activeNote) return;
    await client.delete(`/notes/${activeNote.id}`);
    setActiveId(null);
    toast.success('Note deleted');
  };

  const addTag = () => {
    if (!tagInput.trim() || !activeNote) return;
    const nextTags = [...new Set([...(activeNote.tags || []), tagInput.trim()])];
    setTagInput('');
    setDraft({ tags: nextTags });
  };

  const filteredNotes = notes.filter((note) => `${note.title} ${note.content} ${(note.tags || []).join(' ')}`
    .toLowerCase().includes(query.toLowerCase()));

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Toaster />
        <div className="w-full max-w-md rounded bg-white p-6 shadow space-y-3">
          <h1 className="text-2xl font-bold">NoteApp-Elite</h1>
          <input className="w-full border p-2" placeholder="Email" onChange={(e) => setAuthForm((f) => ({ ...f, email: e.target.value }))} />
          <input className="w-full border p-2" type="password" placeholder="Password" onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))} />
          <div className="flex gap-2">
            <button disabled={authLoading} onClick={() => submitAuth('signup')} className="px-3 py-2 rounded bg-slate-900 text-white">{authLoading ? 'Working...' : 'Sign up'}</button>
            <button disabled={authLoading} onClick={() => submitAuth('login')} className="px-3 py-2 rounded border">Login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen grid grid-cols-[320px_1fr]">
      <Toaster />
      <aside className="border-r bg-white p-4 space-y-3 overflow-auto">
        <div className="flex gap-2">
          <button onClick={createNote} className="flex-1 py-2 rounded bg-slate-900 text-white">+ New</button>
          <button onClick={() => { localStorage.removeItem('token'); setToken(null); }} className="px-3 rounded border">Logout</button>
        </div>
        <input className="w-full border p-2" placeholder="Search title/content/tags" value={query} onChange={(e) => setQuery(e.target.value)} />
        {filteredNotes.map((note) => (
          <button key={note.id} onClick={() => setActiveId(note.id)} className="w-full rounded border p-2 text-left" style={{ background: note.color }}>
            <div className="font-semibold truncate">{note.title}</div>
            <div className="text-xs text-slate-600">{(note.tags || []).join(', ')}</div>
          </button>
        ))}
      </aside>
      <main className="p-4 overflow-auto">
        {!activeNote ? <div className="text-slate-500">Select or create a note.</div> : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input className="flex-1 border-b text-2xl font-semibold" value={activeNote.title} onChange={(e) => setDraft({ title: e.target.value })} />
              <button onClick={deleteNote} className="border rounded px-3">Delete</button>
            </div>
            <div className="flex items-center gap-2">
              {NOTE_COLORS.map((color) => (
                <button key={color} className="w-7 h-7 rounded-full border" style={{ background: color }} onClick={() => setDraft({ color })} />
              ))}
            </div>
            <div className="flex gap-2">
              <input className="border p-2 rounded" placeholder="Add tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
              <button onClick={addTag} className="px-3 py-2 rounded border">Add tag</button>
            </div>
            <RichEditor value={activeNote.content} onChange={(content) => setDraft({ content })} />
          </div>
        )}
      </main>
    </div>
  );
}
