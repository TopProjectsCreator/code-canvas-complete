import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Database, FileText, Plus, Save, Trash2, Wand2, Link2, X, ZoomIn, ZoomOut, Maximize2, Undo2, Redo2, Paperclip, Upload } from "lucide-react";
import type { FileNode } from "@/types/ide";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface DatabaseDesignerPaneProps {
  files: FileNode[];
  onFileUpdate: (fileId: string, content: string) => void;
}

interface DocLink {
  /** Display label, e.g. "Spec.docx" or "Pricing rules" */
  label: string;
  /** Either a path to a file in the project (e.g. "docs/spec.docx") or an external URL */
  href: string;
  /** "file" = lives in the canvas/workspace, "external" = URL/upload */
  kind?: "file" | "external";
}

interface ColumnModel {
  name: string;
  type: string;
  nullable?: boolean;
  pk?: boolean;
  unique?: boolean;
  default?: string;
  ref?: string;
  docs?: DocLink[];
}

interface TableModel {
  name: string;
  columns: ColumnModel[];
  docs?: DocLink[];
}

interface RelationshipModel {
  from: string;
  to: string;
  type: string;
}

interface DatabaseModel {
  project: string;
  dialect: string;
  tables: TableModel[];
  relationships: RelationshipModel[];
  layout?: Record<string, { x: number; y: number }>;
}

const DEFAULT_MODEL: DatabaseModel = {
  project: "SaaS Starter",
  dialect: "postgres",
  tables: [
    {
      name: "organizations",
      columns: [
        { name: "id", type: "uuid", pk: true, default: "gen_random_uuid()" },
        { name: "name", type: "text", nullable: false },
        { name: "plan", type: "text", nullable: false, default: "'free'" },
      ],
    },
    {
      name: "users",
      columns: [
        { name: "id", type: "uuid", pk: true, default: "gen_random_uuid()" },
        { name: "organization_id", type: "uuid", nullable: false, ref: "organizations.id" },
        { name: "email", type: "text", nullable: false, unique: true },
      ],
    },
  ],
  relationships: [{ from: "users.organization_id", to: "organizations.id", type: "many-to-one" }],
  layout: {
    organizations: { x: 80, y: 80 },
    users: { x: 420, y: 120 },
  },
};

const TABLE_WIDTH = 260;

const flattenFiles = (nodes: FileNode[]): FileNode[] =>
  nodes.flatMap((node) => (node.type === "folder" && node.children ? flattenFiles(node.children) : [node]));

const ensureLayout = (model: DatabaseModel): DatabaseModel => {
  const layout = { ...(model.layout || {}) };
  model.tables.forEach((table, index) => {
    if (!layout[table.name]) {
      layout[table.name] = { x: 80 + (index % 3) * 320, y: 80 + Math.floor(index / 3) * 220 };
    }
  });
  return { ...model, layout };
};

const buildSqlExport = (model: DatabaseModel): string => {
  const tableSql = model.tables
    .map((table) => {
      const columnDefs = table.columns.map((col) => {
        const parts = [col.name, col.type];
        if (col.pk) parts.push("PRIMARY KEY");
        if (col.nullable === false) parts.push("NOT NULL");
        if (col.unique) parts.push("UNIQUE");
        if (col.default) parts.push(`DEFAULT ${col.default}`);
        if (col.ref) {
          const [refTable, refColumn] = col.ref.split(".");
          parts.push(`REFERENCES ${refTable}(${refColumn})`);
        }
        return `  ${parts.join(" ")}`;
      });
      return `CREATE TABLE ${table.name} (\n${columnDefs.join(",\n")}\n);`;
    })
    .join("\n\n");

  const relationshipComments = model.relationships
    .map((rel) => `-- ${rel.type}: ${rel.from} -> ${rel.to}`)
    .join("\n");

  return `-- Database Designer SQL Export\n-- Project: ${model.project}\n-- Dialect: ${model.dialect}\n\n${relationshipComments ? `${relationshipComments}\n\n` : ""}${tableSql}\n`;
};

export const DatabaseDesignerPane = ({ files, onFileUpdate }: DatabaseDesignerPaneProps) => {
  const flatFiles = useMemo(() => flattenFiles(files), [files]);
  const erdFile = flatFiles.find((f) => f.name === "erd.schema.json");
  const sqlFile = flatFiles.find((f) => f.name === "schema.export.sql");
  const constraintsFile = flatFiles.find((f) => f.name === "constraints.md");

  const [model, setModel] = useState<DatabaseModel>(DEFAULT_MODEL);
  const [parseError, setParseError] = useState<string | null>(null);
  const [sqlPreview, setSqlPreview] = useState("-- SQL export preview");
  const [constraintsDoc, setConstraintsDoc] = useState("# Constraints\n\n- Capture table-level and column-level constraints here.");
  const [selectedTable, setSelectedTable] = useState<string>(DEFAULT_MODEL.tables[0]?.name || "");
  const [newRelFrom, setNewRelFrom] = useState("");
  const [newRelTo, setNewRelTo] = useState("");
  const [drag, setDrag] = useState<{ name: string; dx: number; dy: number; moved: boolean } | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const v = parseFloat(localStorage.getItem("dbDesigner.zoom") || "1");
    return isNaN(v) ? 1 : Math.min(2, Math.max(0.4, v));
  });
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const restoredScrollRef = useRef(false);
  const pinchRef = useRef<{ initialDist: number; initialZoom: number } | null>(null);

  // Undo / redo history. Each entry is a deep-cloned model snapshot.
  const historyRef = useRef<{ past: DatabaseModel[]; future: DatabaseModel[]; suspend: boolean }>({
    past: [],
    future: [],
    suspend: false,
  });
  const [, forceHistoryRender] = useState(0);
  const cloneModel = (m: DatabaseModel): DatabaseModel => JSON.parse(JSON.stringify(m));
  const pushHistory = (current: DatabaseModel) => {
    if (historyRef.current.suspend) return;
    historyRef.current.past.push(cloneModel(current));
    if (historyRef.current.past.length > 100) historyRef.current.past.shift();
    historyRef.current.future = [];
    forceHistoryRender((x) => x + 1);
  };
  /** Mutate the model AND record the previous state for undo. */
  const updateModel = (updater: (prev: DatabaseModel) => DatabaseModel) => {
    setModel((prev) => {
      pushHistory(prev);
      return updater(prev);
    });
  };
  const undo = () => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    setModel((current) => {
      const prev = h.past.pop()!;
      h.future.push(cloneModel(current));
      forceHistoryRender((x) => x + 1);
      return prev;
    });
  };
  const redo = () => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    setModel((current) => {
      const next = h.future.pop()!;
      h.past.push(cloneModel(current));
      forceHistoryRender((x) => x + 1);
      return next;
    });
  };
  // Doc linking dialog target: "table:foo" or "column:foo.bar"
  const [docTarget, setDocTarget] = useState<string | null>(null);

  const clampZoom = (z: number) => Math.min(2, Math.max(0.4, z));
  const zoomIn = () => setZoom((z) => clampZoom(+(z + 0.1).toFixed(2)));
  const zoomOut = () => setZoom((z) => clampZoom(+(z - 0.1).toFixed(2)));
  const zoomReset = () => setZoom(1);
  const fitToScreen = () => {
    const el = scrollRef.current;
    if (!el) { setZoom(1); return; }
    // Compute bounding box of all tables in canvas coords
    const positions = Object.values(model.layout || {});
    if (positions.length === 0) { setZoom(1); return; }
    const maxX = Math.max(...positions.map((p) => p.x)) + TABLE_WIDTH + 40;
    const maxY = Math.max(...positions.map((p) => p.y)) + 240;
    const fitX = el.clientWidth / Math.max(maxX, 600);
    const fitY = el.clientHeight / Math.max(maxY, 400);
    setZoom(clampZoom(+Math.min(fitX, fitY, 1).toFixed(2)));
    requestAnimationFrame(() => { el.scrollLeft = 0; el.scrollTop = 0; });
  };

  // Persist zoom
  useEffect(() => {
    localStorage.setItem("dbDesigner.zoom", String(zoom));
  }, [zoom]);

  // Restore scroll position once on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || restoredScrollRef.current) return;
    const sx = parseInt(localStorage.getItem("dbDesigner.scrollX") || "0", 10);
    const sy = parseInt(localStorage.getItem("dbDesigner.scrollY") || "0", 10);
    requestAnimationFrame(() => {
      el.scrollLeft = sx;
      el.scrollTop = sy;
      restoredScrollRef.current = true;
    });
  }, []);

  // Persist scroll position (throttled via rAF)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        localStorage.setItem("dbDesigner.scrollX", String(el.scrollLeft));
        localStorage.setItem("dbDesigner.scrollY", String(el.scrollTop));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Touch pinch-to-zoom + two-finger pan
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchRef.current = { initialDist: dist(e.touches[0], e.touches[1]), initialZoom: zoom };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const d = dist(e.touches[0], e.touches[1]);
        const ratio = d / pinchRef.current.initialDist;
        setZoom(clampZoom(+(pinchRef.current.initialZoom * ratio).toFixed(2)));
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
    };
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [zoom]);


  useEffect(() => {
    if (!erdFile?.content) return;
    try {
      const parsed = JSON.parse(erdFile.content) as DatabaseModel;
      const withLayout = ensureLayout(parsed);
      setModel(withLayout);
      if (withLayout.tables.length > 0) setSelectedTable(withLayout.tables[0].name);
      setParseError(null);
    } catch {
      setParseError("Invalid JSON in erd.schema.json — using in-memory state until fixed.");
    }
  }, [erdFile?.content]);

  useEffect(() => {
    if (sqlFile?.content) setSqlPreview(sqlFile.content);
  }, [sqlFile?.content]);

  useEffect(() => {
    if (constraintsFile?.content) setConstraintsDoc(constraintsFile.content);
  }, [constraintsFile?.content]);

  const columnKeys = useMemo(
    () => model.tables.flatMap((t) => t.columns.map((c) => `${t.name}.${c.name}`)),
    [model.tables],
  );

  const selected = model.tables.find((t) => t.name === selectedTable) || null;

  const updateSelectedTable = (updater: (table: TableModel) => TableModel) => {
    if (!selected) return;
    updateModel((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => (t.name === selected.name ? updater(t) : t)),
    }));
  };

  const addTable = () => {
    const base = "new_table";
    let name = base;
    let i = 1;
    while (model.tables.some((t) => t.name === name)) {
      name = `${base}_${i++}`;
    }
    updateModel((prev) => {
      const next = ensureLayout({
        ...prev,
        tables: [...prev.tables, { name, columns: [{ name: "id", type: "uuid", pk: true }] }],
      });
      next.layout = {
        ...next.layout,
        [name]: { x: 100 + (prev.tables.length % 3) * 320, y: 120 + Math.floor(prev.tables.length / 3) * 220 },
      };
      return next;
    });
    setSelectedTable(name);
  };

  const addRelationship = () => {
    if (!newRelFrom || !newRelTo) return;
    updateModel((prev) => ({
      ...prev,
      relationships: [...prev.relationships, { from: newRelFrom, to: newRelTo, type: "many-to-one" }],
    }));
    setNewRelFrom("");
    setNewRelTo("");
  };

  const regenerateSql = () => {
    setSqlPreview(buildSqlExport(model));
  };

  const saveAll = () => {
    if (erdFile) onFileUpdate(erdFile.id, JSON.stringify(model, null, 2));
    if (sqlFile) onFileUpdate(sqlFile.id, sqlPreview || buildSqlExport(model));
    if (constraintsFile) onFileUpdate(constraintsFile.id, constraintsDoc);
  };

  const startDrag = (name: string, clientX: number, clientY: number) => {
    const pos = model.layout?.[name] || { x: 80, y: 80 };
    const z = zoom || 1;
    // Snapshot before the drag begins so the entire move is one undo step
    pushHistory(model);
    setDrag({ name, dx: clientX / z - pos.x, dy: clientY / z - pos.y, moved: false });
  };

  const onCanvasMove = (clientX: number, clientY: number) => {
    if (!drag) return;
    const z = zoom || 1;
    setModel((prev) => ({
      ...prev,
      layout: {
        ...(prev.layout || {}),
        [drag.name]: { x: Math.max(12, clientX / z - drag.dx), y: Math.max(12, clientY / z - drag.dy) },
      },
    }));
    if (!drag.moved) setDrag({ ...drag, moved: true });
  };

  const endDrag = () => {
    // If the user clicked without moving, drop the snapshot we pushed in startDrag
    if (drag && !drag.moved) {
      historyRef.current.past.pop();
      forceHistoryRender((x) => x + 1);
    }
    setDrag(null);
  };

  const deleteTable = (name: string) => {
    updateModel((prev) => {
      const layout = { ...(prev.layout || {}) };
      delete layout[name];
      return {
        ...prev,
        tables: prev.tables.filter((t) => t.name !== name),
        relationships: prev.relationships.filter((r) => r.from.split(".")[0] !== name && r.to.split(".")[0] !== name),
        layout,
      };
    });
    if (selectedTable === name) setSelectedTable("");
    if (connectFrom?.startsWith(`${name}.`)) setConnectFrom(null);
  };

  const deleteRelationship = (idx: number) => {
    updateModel((prev) => ({ ...prev, relationships: prev.relationships.filter((_, i) => i !== idx) }));
  };

  const deleteColumn = (colIdx: number) => {
    if (!selected) return;
    const colName = selected.columns[colIdx]?.name;
    updateSelectedTable((table) => ({ ...table, columns: table.columns.filter((_, i) => i !== colIdx) }));
    if (colName) {
      setModel((prev) => ({
        ...prev,
        relationships: prev.relationships.filter(
          (r) => r.from !== `${selected.name}.${colName}` && r.to !== `${selected.name}.${colName}`,
        ),
      }));
    }
  };

  const handlePinClick = (key: string) => {
    if (!connectFrom) {
      setConnectFrom(key);
      return;
    }
    if (connectFrom === key) {
      setConnectFrom(null);
      return;
    }
    updateModel((prev) => ({
      ...prev,
      relationships: [...prev.relationships, { from: connectFrom, to: key, type: "many-to-one" }],
    }));
    setConnectFrom(null);
  };

  // Doc-link helpers
  const addDocLinkToTable = (tableName: string, link: DocLink) => {
    updateModel((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => t.name === tableName ? { ...t, docs: [...(t.docs || []), link] } : t),
    }));
  };
  const addDocLinkToColumn = (tableName: string, colName: string, link: DocLink) => {
    updateModel((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => t.name === tableName ? {
        ...t,
        columns: t.columns.map((c) => c.name === colName ? { ...c, docs: [...(c.docs || []), link] } : c),
      } : t),
    }));
  };
  const removeDocLink = (target: string, idx: number) => {
    updateModel((prev) => {
      if (target.startsWith("table:")) {
        const tn = target.slice(6);
        return { ...prev, tables: prev.tables.map((t) => t.name === tn ? { ...t, docs: (t.docs || []).filter((_, i) => i !== idx) } : t) };
      }
      if (target.startsWith("column:")) {
        const [tn, cn] = target.slice(7).split(".");
        return { ...prev, tables: prev.tables.map((t) => t.name === tn ? {
          ...t, columns: t.columns.map((c) => c.name === cn ? { ...c, docs: (c.docs || []).filter((_, i) => i !== idx) } : c),
        } : t) };
      }
      return prev;
    });
  };

  // Keyboard shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Skip when typing in editable inputs/textareas
      const tag = target?.tagName?.toLowerCase();
      const isEditable = tag === "input" || tag === "textarea" || target?.isContentEditable;
      if (isEditable) return;
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background p-4 space-y-4">
      <div className="rounded-xl border border-border p-4 bg-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="h-4 w-4" />
            <h2 className="font-semibold">Database Designer — Visual ERD + Flowchart + SQL Export</h2>
          </div>
          <p className="text-sm text-muted-foreground">Drag tables on canvas, map relationships, document constraints, and export SQL.</p>
          {parseError && <p className="text-xs text-destructive mt-1">{parseError}</p>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={regenerateSql}><Wand2 className="h-3.5 w-3.5 mr-1" />Generate SQL</Button>
          <Button size="sm" onClick={saveAll}><Save className="h-3.5 w-3.5 mr-1" />Save All</Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr] flex-1 min-h-0">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <h3 className="font-medium">Visual schema canvas</h3>
            <div className="flex gap-2 items-center flex-wrap">
              {connectFrom && (
                <Badge variant="default" className="gap-1">
                  <Link2 className="h-3 w-3" />Connecting from {connectFrom}
                  <button onClick={() => setConnectFrom(null)} className="ml-1 hover:opacity-70"><X className="h-3 w-3" /></button>
                </Badge>
              )}
              <Badge variant="outline">ERD</Badge>
              <div className="flex items-center gap-0.5 border border-border rounded-md">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={undo} disabled={historyRef.current.past.length === 0} title="Undo (Ctrl/Cmd+Z)"><Undo2 className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={redo} disabled={historyRef.current.future.length === 0} title="Redo (Ctrl/Cmd+Shift+Z)"><Redo2 className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="flex items-center gap-0.5 border border-border rounded-md">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={zoomOut} title="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></Button>
                <button onClick={zoomReset} className="text-xs font-mono w-12 text-center hover:bg-muted rounded py-1" title="Reset to 100%">{Math.round(zoom * 100)}%</button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={zoomIn} title="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={fitToScreen} title="Fit all tables in view"><Maximize2 className="h-3.5 w-3.5" /></Button>
              </div>
              <Button size="sm" variant="outline" onClick={addTable}><Plus className="h-3.5 w-3.5 mr-1" />Add table</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Drag table headers to move • Click a column dot to start a connection, then click another column to link • Hover a table to delete
          </p>

          <div
            ref={scrollRef}
            className="relative h-full min-h-[400px] rounded-lg border border-dashed border-border bg-muted/20 overflow-auto"
            style={{ touchAction: "pan-x pan-y" }}
          >
            <div
              className="relative"
              style={{
                width: 1200 * zoom,
                height: 800 * zoom,
                minWidth: 1200 * zoom,
                minHeight: 800 * zoom,
              }}
            >
            <div
              className="relative w-full h-full origin-top-left"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: 1200, height: 800 }}
              onMouseMove={(e) => {
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                onCanvasMove(e.clientX - rect.left, e.clientY - rect.top);
              }}
              onMouseUp={endDrag}
              onMouseLeave={endDrag}
            >
              <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
                {model.relationships.map((rel, i) => {
                  const fromTable = rel.from.split(".")[0];
                  const toTable = rel.to.split(".")[0];
                  const from = model.layout?.[fromTable];
                  const to = model.layout?.[toTable];
                  if (!from || !to) return null;
                  const x1 = from.x + TABLE_WIDTH;
                  const y1 = from.y + 48;
                  const x2 = to.x;
                  const y2 = to.y + 48;
                  return (
                    <g key={`${rel.from}-${rel.to}-${i}`}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--primary))" strokeWidth="2" />
                      <circle cx={x2} cy={y2} r="4" fill="hsl(var(--primary))" />
                    </g>
                  );
                })}
              </svg>

              {model.tables.map((table) => {
                const pos = model.layout?.[table.name] || { x: 40, y: 40 };
                return (
                  <div
                    key={table.name}
                    className={`group absolute rounded-lg border bg-background shadow-sm ${selectedTable === table.name ? "ring-2 ring-primary" : ""}`}
                    style={{ left: pos.x, top: pos.y, width: TABLE_WIDTH }}
                    onClick={() => setSelectedTable(table.name)}
                  >
                    <div
                      className="px-3 py-2 border-b bg-muted/50 cursor-move flex items-center justify-between"
                      onMouseDown={(e) => { e.preventDefault(); startDrag(table.name, e.clientX - (e.currentTarget.parentElement?.parentElement?.getBoundingClientRect().left ?? 0), e.clientY - (e.currentTarget.parentElement?.parentElement?.getBoundingClientRect().top ?? 0)); }}
                    >
                      <strong className="text-sm">{table.name}</strong>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary">{table.columns.length}</Badge>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/20 text-destructive"
                          onClick={(e) => { e.stopPropagation(); if (confirm(`Delete table "${table.name}"?`)) deleteTable(table.name); }}
                          title="Delete table"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="p-2 text-xs space-y-1">
                      {table.columns.map((col, colIdx) => {
                        const key = `${table.name}.${col.name}`;
                        const isConnectFrom = connectFrom === key;
                        return (
                          <div key={`${table.name}-col-${colIdx}`} className="flex items-center gap-1.5 group/col">
                            <button
                              className={`shrink-0 h-2.5 w-2.5 rounded-full border ${isConnectFrom ? "bg-primary border-primary" : "bg-muted hover:bg-primary/50 border-border"}`}
                              onClick={(e) => { e.stopPropagation(); handlePinClick(key); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              title={connectFrom ? (isConnectFrom ? "Cancel" : `Connect ${connectFrom} → ${key}`) : "Start connection"}
                            />
                            <input
                              value={col.name}
                              onFocus={() => pushHistory(model)}
                              onChange={(e) => {
                                const v = e.target.value;
                                setModel((prev) => ({
                                  ...prev,
                                  tables: prev.tables.map((t) => t.name === table.name ? {
                                    ...t,
                                    columns: t.columns.map((c, i) => i === colIdx ? { ...c, name: v } : c),
                                  } : t),
                                }));
                              }}
                              onClick={(e) => { e.stopPropagation(); setSelectedTable(table.name); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="flex-1 min-w-0 bg-transparent font-mono outline-none focus:bg-muted/40 rounded px-1"
                            />
                            <input
                              value={col.type}
                              onFocus={() => pushHistory(model)}
                              onChange={(e) => {
                                const v = e.target.value;
                                setModel((prev) => ({
                                  ...prev,
                                  tables: prev.tables.map((t) => t.name === table.name ? {
                                    ...t,
                                    columns: t.columns.map((c, i) => i === colIdx ? { ...c, type: v } : c),
                                  } : t),
                                }));
                              }}
                              onClick={(e) => { e.stopPropagation(); setSelectedTable(table.name); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="w-20 shrink-0 bg-transparent text-muted-foreground font-mono outline-none focus:bg-muted/40 focus:text-foreground rounded px-1 text-right"
                            />
                            <button
                              className="opacity-0 group-hover/col:opacity-100 text-destructive hover:opacity-100 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTable(table.name);
                                setTimeout(() => deleteColumn(colIdx), 0);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              title="Delete column"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                      <button
                        className="w-full text-left text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded px-1 py-0.5 flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTable(table.name);
                          updateModel((prev) => ({
                            ...prev,
                            tables: prev.tables.map((t) => t.name === table.name ? {
                              ...t, columns: [...t.columns, { name: "new_column", type: "text" }],
                            } : t),
                          }));
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <Plus className="h-3 w-3" /> add column
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-3 space-y-3">
            <h3 className="font-medium">Table editor</h3>
            <div className="flex flex-wrap gap-2">
              {model.tables.map((t) => (
                <Button key={t.name} variant={selectedTable === t.name ? "default" : "outline"} size="sm" onClick={() => setSelectedTable(t.name)}>{t.name}</Button>
              ))}
            </div>

            {selected && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Editing <code>{selected.name}</code></span>
                  <Button size="sm" variant="ghost" className="text-destructive h-7" onClick={() => { if (confirm(`Delete table "${selected.name}"?`)) deleteTable(selected.name); }}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" />Delete table
                  </Button>
                </div>
                {selected.columns.map((col, idx) => (
                  <div key={`${selected.name}-${idx}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input
                      value={col.name}
                      onChange={(e) =>
                        updateSelectedTable((table) => ({
                          ...table,
                          columns: table.columns.map((c, i) => (i === idx ? { ...c, name: e.target.value } : c)),
                        }))
                      }
                      placeholder="column"
                    />
                    <Input
                      value={col.type}
                      onChange={(e) =>
                        updateSelectedTable((table) => ({
                          ...table,
                          columns: table.columns.map((c, i) => (i === idx ? { ...c, type: e.target.value } : c)),
                        }))
                      }
                      placeholder="type"
                    />
                    <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => deleteColumn(idx)} title="Delete column">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateSelectedTable((table) => ({
                      ...table,
                      columns: [...table.columns, { name: "new_column", type: "text" }],
                    }))
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />Add column
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-3 space-y-3">
            <h3 className="font-medium">Relationships</h3>
            <p className="text-xs text-muted-foreground">Tip: click column dots on the canvas to draw a connection visually.</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={newRelFrom} onChange={(e) => setNewRelFrom(e.target.value)}>
                <option value="">From…</option>
                {columnKeys.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={newRelTo} onChange={(e) => setNewRelTo(e.target.value)}>
                <option value="">To…</option>
                {columnKeys.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <Button size="sm" variant="outline" onClick={addRelationship} disabled={!newRelFrom || !newRelTo}>Add relationship</Button>
            <div className="max-h-40 overflow-auto text-xs space-y-1">
              {model.relationships.map((rel, i) => (
                <div key={`${rel.from}-${rel.to}-${i}`} className="rounded border border-border px-2 py-1 flex items-center justify-between gap-2">
                  <span className="truncate">{rel.type}: {rel.from} → {rel.to}</span>
                  <button onClick={() => deleteRelationship(i)} className="text-destructive hover:opacity-70 shrink-0" title="Delete relationship">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {model.relationships.length === 0 && <p className="text-muted-foreground italic">No relationships yet.</p>}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <h3 className="font-medium flex items-center gap-2"><FileText className="h-4 w-4" />Constraint documentation</h3>
            <Textarea value={constraintsDoc} onChange={(e) => setConstraintsDoc(e.target.value)} className="min-h-[150px] text-xs" />
            <p className="text-xs text-muted-foreground">Saved to <code>constraints.md</code>.</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <h3 className="font-medium">SQL export</h3>
            <Textarea value={sqlPreview} onChange={(e) => setSqlPreview(e.target.value)} className="min-h-[180px] font-mono text-xs" />
          </div>
        </div>
      </div>
    </div>
  );
};
