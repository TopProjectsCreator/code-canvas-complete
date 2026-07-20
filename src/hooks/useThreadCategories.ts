import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ThreadCategory = {
  id: string;
  name: string;
  sort_order: number;
};

export function useThreadCategories() {
  const [categories, setCategories] = useState<ThreadCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('thread_categories')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (!error) setCategories((data || []) as ThreadCategory[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { categories, loading, refresh };
}

export async function createCategory(name: string, sortOrder = 0) {
  const { error } = await supabase
    .from('thread_categories')
    .insert({ name: name.trim(), sort_order: sortOrder });
  if (error) throw error;
}

export async function renameCategory(id: string, name: string) {
  const { error } = await supabase
    .from('thread_categories')
    .update({ name: name.trim() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase
    .from('thread_categories')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
