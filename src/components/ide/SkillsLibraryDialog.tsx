import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMCPAndSkills } from '@/hooks/useMCPAndSkills';

interface SkillsLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExternalSkill {
  name: string;
  description: string;
  category: string;
  instruction?: string;
}

export function SkillsLibraryDialog({ open, onOpenChange }: SkillsLibraryDialogProps) {
  const [skills, setSkills] = useState<ExternalSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const { addSkill } = useMCPAndSkills();
  const { toast } = useToast();

  useEffect(() => {
    if (open && skills.length === 0) {
      fetchSkills();
    }
  }, [open]);

  const fetchSkills = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-ai-skills');
      
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      
      setSkills(data?.skills || []);
    } catch (err: any) {
      console.error('Error fetching skills:', err);
      setError(err.message || 'Failed to fetch skills from directory');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (skill: ExternalSkill) => {
    const defaultInstruction = skill.instruction || `Act as a ${skill.name}. ${skill.description}`;
    const ok = await addSkill({
      name: skill.name,
      description: skill.description,
      instruction: defaultInstruction,
      icon: 'sparkles',
    });
    
    if (ok) {
      toast({ title: 'Skill Added', description: `${skill.name} has been added to your skills.` });
    }
  };

  const filteredSkills = skills.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.description.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Skills Library
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Discover and install community-created AI skills from ai-skills.io.
          </p>
        </DialogHeader>

        <div className="p-4 border-b border-border/50 bg-muted/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search skills, categories..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Fetching skills library...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive text-center px-6">
              <AlertCircle className="w-10 h-10 mb-4 opacity-80" />
              <p className="font-medium mb-2">Could not load skills</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchSkills} className="mt-4">
                Try Again
              </Button>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center">
              <Sparkles className="w-10 h-10 mb-4 opacity-20" />
              <p>No skills found matching your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSkills.map((skill, idx) => (
                <div key={idx} className="flex flex-col justify-between p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors gap-3">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className="font-medium text-sm leading-tight">{skill.name}</h4>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {skill.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {skill.description}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="default" 
                    className="w-full gap-1.5 h-8 text-xs"
                    onClick={() => handleAdd(skill)}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add to Agent
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
