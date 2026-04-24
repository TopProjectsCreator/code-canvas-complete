import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Database, FileText, Plus, Save, Trash2, Wand2, Link2, X } from "lucide-react";
import type { FileNode } from "@/types/ide";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface DatabaseDesignerPaneProps {
  files: FileNode[];
  onFileUpdate: (fileId: string, content: string) => void;
}

interface ColumnModel {
  name: string;
  type: string;
  nullable?: boolean;
  pk?: boolean;
  unique?: boolean;
  default?: string;
  ref?: string;
}

interface TableModel {
  name: string;
  columns: ColumnModel[];
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
    setModel((prev) => ({
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
    setModel((prev) => {
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
    setModel((prev) => ({
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
    setDrag({ name, dx: clientX - pos.x, dy: clientY - pos.y });
  };

  const onCanvasMove = (clientX: number, clientY: number) => {
    if (!drag) return;
    setModel((prev) => ({
      ...prev,
      layout: {
        ...(prev.layout || {}),
        [drag.name]: { x: Math.max(12, clientX - drag.dx), y: Math.max(12, clientY - drag.dy) },
      },
    }));
  };

  return (
    <div
      className="h-full overflow-auto bg-background p-4 space-y-4"
      onMouseMove={(e) => onCanvasMove(e.clientX, e.clientY)}
      onMouseUp={() => setDrag(null)}
      onMouseLeave={() => setDrag(null)}
    >
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

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Visual schema canvas</h3>
            <div className="flex gap-2">
              <Badge variant="outline">ERD</Badge>
              <Badge variant="outline">Flowchart</Badge>
              <Button size="sm" variant="outline" onClick={addTable}><Plus className="h-3.5 w-3.5 mr-1" />Add table</Button>
            </div>
          </div>

          <div className="relative min-h-[560px] rounded-lg border border-dashed border-border bg-muted/20 overflow-hidden">
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
                  className={`absolute max-w-[260px] rounded-lg border bg-background shadow-sm ${selectedTable === table.name ? "ring-2 ring-primary" : ""}`}
                  style={{ left: pos.x, top: pos.y, width: TABLE_WIDTH }}
                  onMouseDown={(e) => startDrag(table.name, e.clientX, e.clientY)}
                  onClick={() => setSelectedTable(table.name)}
                >
                  <div className="px-3 py-2 border-b bg-muted/50 cursor-move flex items-center justify-between">
                    <strong className="text-sm">{table.name}</strong>
                    <Badge variant="secondary">{table.columns.length} cols</Badge>
                  </div>
                  <div className="p-2 text-xs space-y-1">
                    {table.columns.map((col) => (
                      <div key={`${table.name}-${col.name}`} className="flex items-center justify-between gap-2">
                        <span className="font-mono truncate">{col.name}</span>
                        <span className="text-muted-foreground font-mono">{col.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
                {selected.columns.map((col, idx) => (
                  <div key={`${selected.name}-${idx}`} className="grid grid-cols-2 gap-2">
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
            <h3 className="font-medium">Relationship flowchart mapping</h3>
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
            <div className="max-h-28 overflow-auto text-xs space-y-1">
              {model.relationships.map((rel, i) => (
                <div key={`${rel.from}-${rel.to}-${i}`} className="rounded border border-border px-2 py-1">{rel.type}: {rel.from} → {rel.to}</div>
              ))}
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
