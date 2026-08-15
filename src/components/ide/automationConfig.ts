import type { AutomationAuthType } from '@/data/automationIntegrationRegistry';

export interface AutomationBlockInstance {
  id: string;
  type: string;
  label: string;
  category: string;
  subcategory: string;
  auth: AutomationAuthType;
  config: Record<string, string>;
}

const createId = () => Math.random().toString(36).slice(2, 9);

/** Serialize blocks to a JSON string for automation.config.json */
export const serializeAutomationConfig = (blocks: AutomationBlockInstance[]): string => {
  return JSON.stringify({
    version: 1,
    blocks: blocks.map(b => ({
      type: b.type,
      label: b.label,
      category: b.category,
      subcategory: b.subcategory,
      auth: b.auth,
      config: b.config,
    })),
  }, null, 2);
};

/** Parse automation.config.json content into blocks */
export const parseAutomationConfig = (json: string): AutomationBlockInstance[] | null => {
  try {
    const parsed = JSON.parse(json);
    if (!parsed?.blocks || !Array.isArray(parsed.blocks)) return null;
    return parsed.blocks.map((b: any) => ({
      id: createId(),
      type: b.type || '',
      label: b.label || '',
      category: b.category || '',
      subcategory: b.subcategory || '',
      auth: b.auth || 'internal',
      config: b.config || {},
    }));
  } catch {
    return null;
  }
};
