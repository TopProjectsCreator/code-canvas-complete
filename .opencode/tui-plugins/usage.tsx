/** @jsxImportSource @opentui/solid */
import { Database } from "bun:sqlite"
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const RECENT_DAYS = 30
const TOP_SESSIONS = 12
const TOP_MODELS = 20
const MODEL_SESSIONS = 60

export function resolveDbPath() {
  if (process.env.OPENCODE_USAGE_DB) return process.env.OPENCODE_USAGE_DB
  const dataHome =
    process.env.XDG_DATA_HOME ||
    (process.env.HOME ? `${process.env.HOME}/.local/share` : undefined)
  if (!dataHome) throw new Error("cannot resolve opencode data directory")
  return `${dataHome.replace(/\/$/, "")}/opencode/opencode.db`
}

function num(v) {
  return Number(v) || 0
}
function round1(x) {
  return String(Math.round(x * 10) / 10)
}
function fmt(n) {
  n = num(n)
  const a = Math.abs(n)
  if (a >= 1e9) return round1(n / 1e9) + "B"
  if (a >= 1e6) return round1(n / 1e6) + "M"
  if (a >= 1e3) return round1(n / 1e3) + "K"
  return String(n)
}
function fdate(ms) {
  const d = new Date(num(ms))
  return `${MONTHS[d.getMonth()] ?? "?"} ${d.getDate()}`
}
function cut(s, n) {
  s = String(s ?? "")
  return s.length > n ? s.slice(0, Math.max(0, n - 1)) + "…" : s
}
function modelName(providerID, id) {
  if (!id) return "unknown"
  return providerID ? `${providerID}/${id}` : String(id)
}
function modelIdFromRaw(raw) {
  try {
    return JSON.parse(raw || "{}").id
  } catch {
    return undefined
  }
}
function sessionTotals(row) {
  return num(row.ti) + num(row.to_) + num(row.tr) + num(row.tcr) + num(row.tcw)
}

function withDb<T>(fn: (db: Database) => T): T {
  const db = new Database(resolveDbPath(), { readonly: true, fileMustExist: true })
  try {
    db.exec("PRAGMA busy_timeout = 5000")
    return fn(db)
  } finally {
    db.close()
  }
}

export function collectStats() {
  return withDb((db) => {
    const totals = db
      .query(
        `SELECT COUNT(*) sessions, MIN(time_created) first_at,
          SUM(tokens_input) ti, SUM(tokens_output) to_, SUM(tokens_reasoning) tr,
          SUM(tokens_cache_read) tcr, SUM(tokens_cache_write) tcw, SUM(cost) cost
        FROM session`,
      )
      .get()
    const cutoff = Date.now() - RECENT_DAYS * 86400000
    const recent = db
      .query(
        `SELECT COUNT(*) sessions,
          SUM(tokens_input) ti, SUM(tokens_output) to_, SUM(tokens_reasoning) tr,
          SUM(tokens_cache_read) tcr, SUM(tokens_cache_write) tcw
        FROM session WHERE time_updated >= ?`,
      )
      .get(cutoff)
    const biggest = db
      .query(
        `SELECT id, title, model, time_updated tu,
          tokens_input + tokens_output + tokens_reasoning + tokens_cache_read + tokens_cache_write tot
        FROM session ORDER BY tot DESC LIMIT ?`,
      )
      .all(TOP_SESSIONS)
    const models = db
      .query(
        `SELECT json_extract(model, '$.providerID') p, json_extract(model, '$.id') mid,
          COUNT(*) s,
          SUM(tokens_input) ti, SUM(tokens_output) to_, SUM(tokens_reasoning) tr,
          SUM(tokens_cache_read) tcr, SUM(tokens_cache_write) tcw
        FROM session GROUP BY p, mid ORDER BY (to_ * 4 + ti) DESC LIMIT ?`,
      )
      .all(TOP_MODELS)
    return { totals, recent, biggest, models }
  })
}

function collectModelSessions(providerID: string | null, modelID: string | null) {
  return withDb((db) =>
    db
      .query(
        `SELECT id, title, time_updated tu,
          tokens_input ti, tokens_output to_, tokens_reasoning tr,
          tokens_cache_read tcr, tokens_cache_write tcw
        FROM session
        WHERE ((? IS NULL AND json_extract(model, '$.providerID') IS NULL) OR json_extract(model, '$.providerID') IS ?)
          AND ((? IS NULL AND json_extract(model, '$.id') IS NULL) OR json_extract(model, '$.id') IS ?)
        ORDER BY (ti + to_ + tr + tcr + tcw) DESC LIMIT ?`,
      )
      .all(providerID ?? null, providerID ?? null, modelID ?? null, modelID ?? null, MODEL_SESSIONS),
  )
}

type Sel =
  | { kind: "model"; p: string | null; mid: string | null; label: string }
  | { kind: "session"; id: string }

function modelOptions(api: TuiPluginApi, stats: ReturnType<typeof collectStats>) {
  const grand = stats.totals ? sessionTotals(stats.totals) : 0
  const opts = (stats.models || []).map((m) => {
    const share = grand > 0 ? Math.round((sessionTotals(m) / grand) * 100) : 0
    return {
      title: modelName(m.p, m.mid),
      value: { kind: "model", p: m.p, mid: m.mid, label: modelName(m.p, m.mid) } as Sel,
      description: `out ${fmt(m.to_)} · in ${fmt(m.ti)} · ${num(m.s)} sessions · ${share}% of all tokens`,
      category: "Models",
    }
  })
  const top = (stats.biggest || []).map((row) => ({
    title: cut(row.title || "untitled", 60),
    value: { kind: "session", id: row.id } as Sel,
    description: `${fmt(row.tot)} tokens · ${fdate(row.tu)}`,
    category: "Top sessions (all models)",
  }))
  return [...opts, ...top]
}

function openSession(api: TuiPluginApi, id: string) {
  api.ui.dialog.clear()
  api.route.navigate("session", { sessionID: id })
}

function openModelSessions(api: TuiPluginApi, sel: Extract<Sel, { kind: "model" }>) {
  let rows: any[] = []
  try {
    rows = collectModelSessions(sel.p, sel.mid)
  } catch {
    rows = []
  }
  const options = [
    {
      title: "← Back to models",
      value: { kind: "model", p: null, mid: null, label: "__back__" } as Sel,
      description: "",
      category: "",
    },
    ...rows.map((row) => ({
      title: cut(row.title || "untitled", 60),
      value: { kind: "session", id: row.id } as Sel,
      description: `${fmt(sessionTotals(row))} tokens · in ${fmt(row.ti)} out ${fmt(row.to_)} · ${fdate(row.tu)}`,
      category: "",
    })),
  ]
  api.ui.dialog.replace(() => (
    <api.ui.DialogSelect
      title={`${sel.label} · ${rows.length} sessions`}
      options={options}
      placeholder="filter sessions (type to search)"
      onSelect={(o: { value: Sel }) => {
        if (o.value.kind === "session") openSession(api, o.value.id)
        else showModels(api)
      }}
    />
  ))
}

function showModels(api: TuiPluginApi) {
  let stats: ReturnType<typeof collectStats>
  try {
    stats = collectStats()
  } catch (err) {
    api.ui.toast({
      title: "Usage plugin error",
      message: cut(err instanceof Error ? err.message : String(err), 200),
      variant: "error",
      duration: 8000,
    })
    return
  }
  const t = stats.totals
  const title = t
    ? `OpenCode usage · ${num(t.sessions)} sessions · since ${fdate(t.first_at)} · $${num(t.cost).toFixed(2)} · Total ≈${fmt(sessionTotals(t))} tok`
    : "OpenCode usage"
  api.ui.dialog.replace(() => (
    <api.ui.DialogSelect
      title={title}
      options={modelOptions(api, stats)}
      placeholder="filter models / sessions (type to search)"
      onSelect={(o: { value: Sel }) => {
        if (o.value.kind === "model") {
          if (o.value.label === "__back__") return
          openModelSessions(api, o.value)
        } else {
          openSession(api, o.value.id)
        }
      }}
    />
  ))
}

async function showUsage(api: TuiPluginApi) {
  await Promise.resolve(api.ui.dialog.setSize("xlarge"))
  showModels(api)
}

export const tui = async (api: TuiPluginApi) => {
  api.keymap.registerLayer({
    commands: [
      {
        namespace: "palette",
        name: "usage.stats",
        title: "Usage statistics",
        category: "System",
        slashName: "usage",
        run() {
          showUsage(api).catch((err) => {
            api.ui.toast({
              title: "Usage plugin error",
              message: cut(err instanceof Error ? err.message : String(err), 200),
              variant: "error",
              duration: 8000,
            })
          })
        },
      },
    ],
    bindings: [],
  })
}

export default { id: "usage", tui }
