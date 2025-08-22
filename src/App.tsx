import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, Search, Bookmark, Trash2, Wand2, Folder, Tags } from 'lucide-react'

type Note = {
  id: string
  createdAt: string
  original_text: string
  item?: string
  category?: string
  location_text?: string
  room?: string
  container?: string
  tags: string[]
}

const uid = () => Math.random().toString(36).slice(2)

function parseNote(text: string): Partial<Note> {
  // sehr einfacher Parser für Sätze wie:
  // "Ich habe den Schraubenzieher in der Schublade neben dem Bett."
  const t = text.trim()
  const out: Partial<Note> = { original_text: t }
  // basic German/English patterns
  const itemMatch = t.match(/(?:den|die|das|ein(?:en|e)?|my|the)?\s*([\wäöüÄÖÜß-]+(?:(?:\s|-)[\wäöüÄÖÜß-]+)*)\s+(?:in|im|ins|into|inside|at|bei)/i)
  const locMatch = t.match(/(?:in|im|ins|inside|in der|in dem|at|bei)\s+(.+?)(?:\.|$)/i)
  if (itemMatch) out.item = itemMatch[1]
  if (locMatch) out.location_text = locMatch[1]
  // naive Kategorien
  if (out.item) {
    const lower = out.item.toLowerCase()
    if (/(schrauben|schraubenzieher|schraubendreher|zange|hammer)/.test(lower)) out.category = 'Werkzeug'
    if (/(pass|ausweis|urkunde|dokument)/.test(lower)) out.category = 'Dokument'
    if (/(medikament|tablette|vitamin|magnesium|creatin)/.test(lower)) out.category = 'Gesundheit'
    if (/(kabel|adapter|ladegerät|netzteil)/.test(lower)) out.category = 'Elektronik'
  }
  // room clues
  if (/(bett|nacht.?tisch|schlaf)/i.test(t)) out.room = 'Schlafzimmer'
  if (/(küche|kueche|kühlschrank|spüle)/i.test(t)) out.room = 'Küche'
  if (/(keller|abstell)/i.test(t)) out.room = 'Keller/Abstellraum'
  // container clue
  const cont = t.match(/(schublade|kiste|box|koffer|schrank|fach)/i)
  if (cont) out.container = cont[1]
  return out
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem('sb_notes')
    if (!raw) return []
    const arr = JSON.parse(raw) as Note[]
    return arr
  } catch { return [] }
}
function saveNotes(notes: Note[]) {
  localStorage.setItem('sb_notes', JSON.stringify(notes))
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes())
  const [q, setQ] = useState('')
  const [recording, setRecording] = useState(false)
  const recRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => { saveNotes(notes) }, [notes])

  const filtered = useMemo(() => {
    if (!q.trim()) return notes.slice().sort((a,b)=> b.createdAt.localeCompare(a.createdAt))
    const query = q.toLowerCase()
    // simple hybrid: text match + lightweight scoring
    return notes
      .map(n => {
        let score = 0
        const hay = [
          n.original_text,
          n.item || '',
          n.location_text || '',
          n.category || '',
          n.tags.join(' ')
        ].join(' ').toLowerCase()
        if (hay.includes(query)) score += 2
        // synonyms
        if (query.includes('schraube') && (hay.includes('schraubenzieher') || hay.includes('schraubendreher'))) score += 1
        // room hints
        if (query.includes('schlaf') && hay.includes('schlafzimmer')) score += 0.5
        return { n, score }
      })
      .sort((a,b)=> b.score - a.score)
      .map(x => x.n)
  }, [q, notes])

  function addFromText(text: string) {
    const fields = parseNote(text)
    const note: Note = {
      id: uid(),
      createdAt: new Date().toISOString(),
      original_text: text,
      item: fields.item,
      category: fields.category,
      location_text: fields.location_text,
      room: fields.room,
      container: fields.container,
      tags: [],
    }
    setNotes(prev => [note, ...prev])
  }

  function toggleRecord() {
    if (recording) {
      recRef.current?.stop()
      setRecording(false)
      return
    }
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (!SR) {
      alert('Spracherkennung wird von diesem Browser nicht unterstützt.')
      return
    }
    const rec = new SR()
    rec.lang = 'de-DE' // Start in Deutsch; bei Bedarf dynamisch
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript
      addFromText(text)
    }
    rec.onerror = () => setRecording(false)
    rec.onend = () => setRecording(false)
    rec.start()
    recRef.current = rec as SpeechRecognition
    setRecording(true)
  }

  function remove(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Second Brain</h1>
        <div className="flex gap-2">
          <button
            onClick={toggleRecord}
            className={"px-4 py-2 rounded-2xl shadow " + (recording ? "bg-red-600 text-white" : "bg-black text-white")}
            title={recording ? "Aufnahme stoppen" : "Sprachnotiz aufnehmen"}
          >
            <div className="flex items-center gap-2">
              <Mic size={18} /> {recording ? "Stop" : "Merken (Voice)"}
            </div>
          </button>
        </div>
      </header>

      <div className="mb-4">
        <label className="sr-only" htmlFor="q">Suche</label>
        <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 shadow">
          <Search size={18} />
          <input
            id="q"
            className="w-full outline-none"
            placeholder="Frag natürlich: z. B. Wo ist der Schraubenzieher?"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-4">
        <textarea
          placeholder='Oder tippe etwas wie: "Ich habe den Schraubenzieher in der Schublade neben dem Bett."'
          className="w-full rounded-2xl border bg-white p-3 shadow min-h-[90px]"
          onKeyDown={e=>{
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              const v = (e.target as HTMLTextAreaElement).value.trim()
              if (v) {
                addFromText(v)
                ;(e.target as HTMLTextAreaElement).value = ""
              }
            }
          }}
        />
        <div className="text-sm text-gray-500 mt-1">Mit <kbd className="px-1 border rounded">Ctrl</kbd>+<kbd className="px-1 border rounded">Enter</kbd> speichern</div>
      </div>

      <ul className="grid gap-3">
        {filtered.map(n => (
          <li key={n.id}>
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border bg-white p-3 shadow"
            >
              <div className="text-sm text-gray-500">{new Date(n.createdAt).toLocaleString()}</div>
              <div className="font-medium mt-1">{n.original_text}</div>
              <div className="flex flex-wrap gap-2 mt-2 text-sm">
                {n.item && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1"><Bookmark size={14}/> {n.item}</span>}
                {n.location_text && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1"><Folder size={14}/> {n.location_text}</span>}
                {n.category && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1"><Wand2 size={14}/> {n.category}</span>}
                {n.room && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1"><Tags size={14}/> {n.room}</span>}
              </div>
              <div className="mt-2 flex justify-end">
                <button className="text-red-600 hover:underline flex items-center gap-1" onClick={()=>remove(n.id)}>
                  <Trash2 size={16}/> Löschen
                </button>
              </div>
            </motion.div>
          </li>
        ))}
      </ul>
    </div>
  )
}
