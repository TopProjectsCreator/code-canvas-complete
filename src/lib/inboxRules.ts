export type RuleField = 'from' | 'subject' | 'body';
export type RuleOp = 'contains' | 'equals' | 'starts_with';

export interface RuleCondition {
  field: RuleField;
  op: RuleOp;
  value: string;
}

export type RuleAction =
  | { type: 'add_label'; value: string }
  | { type: 'mark_read' }
  | { type: 'forward'; value: string }
  | { type: 'delete' };

export interface InboxRule {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  match: 'all' | 'any';
  conditions: RuleCondition[];
  actions: RuleAction[];
  position: number;
  created_at: string;
  updated_at: string;
}

export interface EvaluatableMessage {
  sender_id: string;
  sender_name?: string | null;
  subject: string;
  body_html: string;
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const fieldValue = (m: EvaluatableMessage, field: RuleField): string => {
  switch (field) {
    case 'from':
      return (m.sender_name || m.sender_id || '').toLowerCase();
    case 'subject':
      return (m.subject || '').toLowerCase();
    case 'body':
      return stripHtml(m.body_html || '').toLowerCase();
  }
};

export const evaluateCondition = (m: EvaluatableMessage, c: RuleCondition): boolean => {
  const haystack = fieldValue(m, c.field);
  const needle = (c.value || '').toLowerCase();
  if (!needle) return false;
  switch (c.op) {
    case 'contains':
      return haystack.includes(needle);
    case 'equals':
      return haystack === needle;
    case 'starts_with':
      return haystack.startsWith(needle);
  }
};

export const ruleMatches = (m: EvaluatableMessage, r: InboxRule): boolean => {
  if (!r.enabled || r.conditions.length === 0) return false;
  if (r.match === 'all') return r.conditions.every((c) => evaluateCondition(m, c));
  return r.conditions.some((c) => evaluateCondition(m, c));
};

export const fieldLabel: Record<RuleField, string> = {
  from: 'From',
  subject: 'Subject',
  body: 'Body',
};

export const opLabel: Record<RuleOp, string> = {
  contains: 'contains',
  equals: 'equals',
  starts_with: 'starts with',
};
