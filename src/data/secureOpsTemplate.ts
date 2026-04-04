import { FileNode } from "@/types/ide";

export const secureOpsTemplate: FileNode[] = [
  {
    id: "root",
    name: "secure-ops-platform",
    type: "folder",
    children: [
      {
        id: "module-auth",
        name: "src/modules/auth.ts",
        type: "file",
        language: "typescript",
        content: `export interface AuthEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeAuthEvent = (event: Partial<AuthEvent>): AuthEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "auth-service",
    summary: event.summary ?? "auth anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreAuthRisk = (event: AuthEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildAuthTimeline = (events: AuthEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupAuthBySeverity = (events: AuthEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-sessions",
        name: "src/modules/sessions.ts",
        type: "file",
        language: "typescript",
        content: `export interface SessionsEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeSessionsEvent = (event: Partial<SessionsEvent>): SessionsEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "sessions-service",
    summary: event.summary ?? "sessions anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreSessionsRisk = (event: SessionsEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildSessionsTimeline = (events: SessionsEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupSessionsBySeverity = (events: SessionsEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-users",
        name: "src/modules/users.ts",
        type: "file",
        language: "typescript",
        content: `export interface UsersEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeUsersEvent = (event: Partial<UsersEvent>): UsersEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "users-service",
    summary: event.summary ?? "users anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreUsersRisk = (event: UsersEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildUsersTimeline = (events: UsersEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupUsersBySeverity = (events: UsersEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-roles",
        name: "src/modules/roles.ts",
        type: "file",
        language: "typescript",
        content: `export interface RolesEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeRolesEvent = (event: Partial<RolesEvent>): RolesEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "roles-service",
    summary: event.summary ?? "roles anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreRolesRisk = (event: RolesEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildRolesTimeline = (events: RolesEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupRolesBySeverity = (events: RolesEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-permissions",
        name: "src/modules/permissions.ts",
        type: "file",
        language: "typescript",
        content: `export interface PermissionsEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizePermissionsEvent = (event: Partial<PermissionsEvent>): PermissionsEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "permissions-service",
    summary: event.summary ?? "permissions anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scorePermissionsRisk = (event: PermissionsEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildPermissionsTimeline = (events: PermissionsEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupPermissionsBySeverity = (events: PermissionsEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-audit",
        name: "src/modules/audit.ts",
        type: "file",
        language: "typescript",
        content: `export interface AuditEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeAuditEvent = (event: Partial<AuditEvent>): AuditEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "audit-service",
    summary: event.summary ?? "audit anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreAuditRisk = (event: AuditEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildAuditTimeline = (events: AuditEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupAuditBySeverity = (events: AuditEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-alerts",
        name: "src/modules/alerts.ts",
        type: "file",
        language: "typescript",
        content: `export interface AlertsEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeAlertsEvent = (event: Partial<AlertsEvent>): AlertsEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "alerts-service",
    summary: event.summary ?? "alerts anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreAlertsRisk = (event: AlertsEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildAlertsTimeline = (events: AlertsEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupAlertsBySeverity = (events: AlertsEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-incidents",
        name: "src/modules/incidents.ts",
        type: "file",
        language: "typescript",
        content: `export interface IncidentsEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeIncidentsEvent = (event: Partial<IncidentsEvent>): IncidentsEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "incidents-service",
    summary: event.summary ?? "incidents anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreIncidentsRisk = (event: IncidentsEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildIncidentsTimeline = (events: IncidentsEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupIncidentsBySeverity = (events: IncidentsEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-forensics",
        name: "src/modules/forensics.ts",
        type: "file",
        language: "typescript",
        content: `export interface ForensicsEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeForensicsEvent = (event: Partial<ForensicsEvent>): ForensicsEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "forensics-service",
    summary: event.summary ?? "forensics anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreForensicsRisk = (event: ForensicsEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildForensicsTimeline = (events: ForensicsEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupForensicsBySeverity = (events: ForensicsEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-network",
        name: "src/modules/network.ts",
        type: "file",
        language: "typescript",
        content: `export interface NetworkEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeNetworkEvent = (event: Partial<NetworkEvent>): NetworkEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "network-service",
    summary: event.summary ?? "network anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreNetworkRisk = (event: NetworkEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildNetworkTimeline = (events: NetworkEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupNetworkBySeverity = (events: NetworkEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-endpoint",
        name: "src/modules/endpoint.ts",
        type: "file",
        language: "typescript",
        content: `export interface EndpointEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeEndpointEvent = (event: Partial<EndpointEvent>): EndpointEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "endpoint-service",
    summary: event.summary ?? "endpoint anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreEndpointRisk = (event: EndpointEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildEndpointTimeline = (events: EndpointEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupEndpointBySeverity = (events: EndpointEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-email",
        name: "src/modules/email.ts",
        type: "file",
        language: "typescript",
        content: `export interface EmailEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeEmailEvent = (event: Partial<EmailEvent>): EmailEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "email-service",
    summary: event.summary ?? "email anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreEmailRisk = (event: EmailEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildEmailTimeline = (events: EmailEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupEmailBySeverity = (events: EmailEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-queue",
        name: "src/modules/queue.ts",
        type: "file",
        language: "typescript",
        content: `export interface QueueEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeQueueEvent = (event: Partial<QueueEvent>): QueueEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "queue-service",
    summary: event.summary ?? "queue anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreQueueRisk = (event: QueueEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildQueueTimeline = (events: QueueEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupQueueBySeverity = (events: QueueEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-scheduler",
        name: "src/modules/scheduler.ts",
        type: "file",
        language: "typescript",
        content: `export interface SchedulerEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeSchedulerEvent = (event: Partial<SchedulerEvent>): SchedulerEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "scheduler-service",
    summary: event.summary ?? "scheduler anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreSchedulerRisk = (event: SchedulerEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildSchedulerTimeline = (events: SchedulerEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupSchedulerBySeverity = (events: SchedulerEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-ratelimit",
        name: "src/modules/ratelimit.ts",
        type: "file",
        language: "typescript",
        content: `export interface RatelimitEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeRatelimitEvent = (event: Partial<RatelimitEvent>): RatelimitEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "ratelimit-service",
    summary: event.summary ?? "ratelimit anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreRatelimitRisk = (event: RatelimitEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildRatelimitTimeline = (events: RatelimitEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupRatelimitBySeverity = (events: RatelimitEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-secrets",
        name: "src/modules/secrets.ts",
        type: "file",
        language: "typescript",
        content: `export interface SecretsEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeSecretsEvent = (event: Partial<SecretsEvent>): SecretsEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "secrets-service",
    summary: event.summary ?? "secrets anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreSecretsRisk = (event: SecretsEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildSecretsTimeline = (events: SecretsEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupSecretsBySeverity = (events: SecretsEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-integrations",
        name: "src/modules/integrations.ts",
        type: "file",
        language: "typescript",
        content: `export interface IntegrationsEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeIntegrationsEvent = (event: Partial<IntegrationsEvent>): IntegrationsEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "integrations-service",
    summary: event.summary ?? "integrations anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreIntegrationsRisk = (event: IntegrationsEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildIntegrationsTimeline = (events: IntegrationsEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupIntegrationsBySeverity = (events: IntegrationsEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-billing",
        name: "src/modules/billing.ts",
        type: "file",
        language: "typescript",
        content: `export interface BillingEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeBillingEvent = (event: Partial<BillingEvent>): BillingEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "billing-service",
    summary: event.summary ?? "billing anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreBillingRisk = (event: BillingEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildBillingTimeline = (events: BillingEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupBillingBySeverity = (events: BillingEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-notifications",
        name: "src/modules/notifications.ts",
        type: "file",
        language: "typescript",
        content: `export interface NotificationsEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeNotificationsEvent = (event: Partial<NotificationsEvent>): NotificationsEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "notifications-service",
    summary: event.summary ?? "notifications anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreNotificationsRisk = (event: NotificationsEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildNotificationsTimeline = (events: NotificationsEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupNotificationsBySeverity = (events: NotificationsEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-compliance",
        name: "src/modules/compliance.ts",
        type: "file",
        language: "typescript",
        content: `export interface ComplianceEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeComplianceEvent = (event: Partial<ComplianceEvent>): ComplianceEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "compliance-service",
    summary: event.summary ?? "compliance anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreComplianceRisk = (event: ComplianceEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildComplianceTimeline = (events: ComplianceEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupComplianceBySeverity = (events: ComplianceEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-reports",
        name: "src/modules/reports.ts",
        type: "file",
        language: "typescript",
        content: `export interface ReportsEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeReportsEvent = (event: Partial<ReportsEvent>): ReportsEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "reports-service",
    summary: event.summary ?? "reports anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreReportsRisk = (event: ReportsEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildReportsTimeline = (events: ReportsEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupReportsBySeverity = (events: ReportsEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-search",
        name: "src/modules/search.ts",
        type: "file",
        language: "typescript",
        content: `export interface SearchEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeSearchEvent = (event: Partial<SearchEvent>): SearchEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "search-service",
    summary: event.summary ?? "search anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreSearchRisk = (event: SearchEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildSearchTimeline = (events: SearchEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupSearchBySeverity = (events: SearchEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-storage",
        name: "src/modules/storage.ts",
        type: "file",
        language: "typescript",
        content: `export interface StorageEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeStorageEvent = (event: Partial<StorageEvent>): StorageEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "storage-service",
    summary: event.summary ?? "storage anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreStorageRisk = (event: StorageEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildStorageTimeline = (events: StorageEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupStorageBySeverity = (events: StorageEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-retention",
        name: "src/modules/retention.ts",
        type: "file",
        language: "typescript",
        content: `export interface RetentionEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeRetentionEvent = (event: Partial<RetentionEvent>): RetentionEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "retention-service",
    summary: event.summary ?? "retention anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreRetentionRisk = (event: RetentionEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildRetentionTimeline = (events: RetentionEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupRetentionBySeverity = (events: RetentionEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-etl",
        name: "src/modules/etl.ts",
        type: "file",
        language: "typescript",
        content: `export interface EtlEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeEtlEvent = (event: Partial<EtlEvent>): EtlEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "etl-service",
    summary: event.summary ?? "etl anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreEtlRisk = (event: EtlEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildEtlTimeline = (events: EtlEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupEtlBySeverity = (events: EtlEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-risk",
        name: "src/modules/risk.ts",
        type: "file",
        language: "typescript",
        content: `export interface RiskEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeRiskEvent = (event: Partial<RiskEvent>): RiskEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "risk-service",
    summary: event.summary ?? "risk anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreRiskRisk = (event: RiskEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildRiskTimeline = (events: RiskEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupRiskBySeverity = (events: RiskEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-anomalies",
        name: "src/modules/anomalies.ts",
        type: "file",
        language: "typescript",
        content: `export interface AnomaliesEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeAnomaliesEvent = (event: Partial<AnomaliesEvent>): AnomaliesEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "anomalies-service",
    summary: event.summary ?? "anomalies anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreAnomaliesRisk = (event: AnomaliesEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildAnomaliesTimeline = (events: AnomaliesEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupAnomaliesBySeverity = (events: AnomaliesEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-policies",
        name: "src/modules/policies.ts",
        type: "file",
        language: "typescript",
        content: `export interface PoliciesEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizePoliciesEvent = (event: Partial<PoliciesEvent>): PoliciesEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "policies-service",
    summary: event.summary ?? "policies anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scorePoliciesRisk = (event: PoliciesEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildPoliciesTimeline = (events: PoliciesEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupPoliciesBySeverity = (events: PoliciesEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-playbooks",
        name: "src/modules/playbooks.ts",
        type: "file",
        language: "typescript",
        content: `export interface PlaybooksEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizePlaybooksEvent = (event: Partial<PlaybooksEvent>): PlaybooksEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "playbooks-service",
    summary: event.summary ?? "playbooks anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scorePlaybooksRisk = (event: PlaybooksEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildPlaybooksTimeline = (events: PlaybooksEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupPlaybooksBySeverity = (events: PlaybooksEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "module-health",
        name: "src/modules/health.ts",
        type: "file",
        language: "typescript",
        content: `export interface HealthEvent {
  id: string;
  tenantId: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  source: string;
  summary: string;
  indicators: string[];
  metadata: Record<string, string | number | boolean>;
}

export const normalizeHealthEvent = (event: Partial<HealthEvent>): HealthEvent => {
  const now = new Date().toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    tenantId: event.tenantId ?? "default-tenant",
    severity: event.severity ?? "medium",
    createdAt: event.createdAt ?? now,
    source: event.source ?? "health-service",
    summary: event.summary ?? "health anomaly detected",
    indicators: event.indicators ?? [],
    metadata: event.metadata ?? {},
  };
};

export const scoreHealthRisk = (event: HealthEvent): number => {
  const base = { low: 15, medium: 45, high: 75, critical: 95 }[event.severity];
  const indicatorWeight = Math.min(event.indicators.length * 3, 15);
  const metadataWeight = Object.keys(event.metadata).length > 6 ? 5 : 0;
  return Math.min(base + indicatorWeight + metadataWeight, 100);
};

export const buildHealthTimeline = (events: HealthEvent[]): string[] => {
  return events
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((event) => `\${event.createdAt} | \${event.severity.toUpperCase()} | \${event.summary}`);
};

export const groupHealthBySeverity = (events: HealthEvent[]) => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.severity] = (acc[event.severity] ?? 0) + 1;
    return acc;
  }, {});
};`,
      },
      {
        id: "package-json",
        name: "package.json",
        type: "file",
        language: "json",
        content: `{
  "name": "secure-ops-platform",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "eslint .",
    "test": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}`,
      },
      {
        id: "tsconfig-json",
        name: "tsconfig.json",
        type: "file",
        language: "json",
        content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"]
}`,
      },
    ],
  },
];
