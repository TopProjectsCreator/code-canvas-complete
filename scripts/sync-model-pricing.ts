// Fetches model pricing from models.dev and upserts into redactor_model_pricing.
// Run: npx tsx scripts/sync-model-pricing.ts
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment or .env

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

interface ModelCost {
  input?: number;
  output?: number;
}

interface ProviderModel {
  id?: string;
  cost?: ModelCost;
}

interface ProviderData {
  models?: Record<string, ProviderModel>;
}

async function fetchPricing(): Promise<{ modelId: string; providerId: string; costInput: number; costOutput: number }[]> {
  console.log("Fetching https://models.dev/api.json …");
  const res = await fetch("https://models.dev/api.json");
  if (!res.ok) throw new Error(`models.dev returned ${res.status}`);
  const data: Record<string, ProviderData> = await res.json();

  const rows: { modelId: string; providerId: string; costInput: number; costOutput: number }[] = [];

  for (const [providerId, provider] of Object.entries(data)) {
    if (!provider.models) continue;
    for (const [modelId, model] of Object.entries(provider.models)) {
      const cost = model.cost;
      if (!cost || cost.input == null || cost.output == null) continue;
      rows.push({
        modelId: `${providerId}/${modelId}`,
        providerId,
        costInput: cost.input,
        costOutput: cost.output,
      });
    }
  }

  console.log(`  Found ${rows.length} model pricing entries`);
  return rows;
}

async function sync() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const rows = await fetchPricing();

  if (rows.length === 0) {
    console.log("No pricing data to sync.");
    return;
  }

  // Upsert in batches of 500
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("redactor_model_pricing").upsert(
      batch.map((r) => ({
        model_id: r.modelId,
        provider_id: r.providerId,
        cost_input: r.costInput,
        cost_output: r.costOutput,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "model_id" },
    );
    if (error) {
      console.error(`Batch ${i / BATCH + 1} failed:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`  Batch ${i / BATCH + 1}: ${batch.length} upserted`);
    }
  }

  console.log(`Done. ${inserted} / ${rows.length} model pricing entries synced.`);
}

sync().catch((e) => {
  console.error("sync failed:", e);
  process.exit(1);
});
