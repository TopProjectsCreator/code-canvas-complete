import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, Plus, Trash2, DollarSign } from 'lucide-react';
import type { useTeamAdmin } from '@/hooks/useTeamAdmin';

interface Props {
  teamAdmin: ReturnType<typeof useTeamAdmin>;
}

export const TeamMembersTab = ({ teamAdmin }: Props) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [editingLimit, setEditingLimit] = useState<string | null>(null);
  const [limitValue, setLimitValue] = useState('');

  const handleAddMember = async () => {
    if (!newEmail.trim() || !teamAdmin.activeTeam) return;
    await teamAdmin.bulkAddMembers(teamAdmin.activeTeam.id, [{ email: newEmail.trim(), display_name: newName.trim() || undefined, role: newRole }]);
    setNewEmail('');
    setNewName('');
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !teamAdmin.activeTeam) return;
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    const members: { email: string; display_name?: string; role?: string }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols[0]?.includes('@')) {
        members.push({ email: cols[0], display_name: cols[1] || undefined, role: cols[2] || 'member' });
      }
    }
    if (members.length > 0) {
      await teamAdmin.bulkAddMembers(teamAdmin.activeTeam.id, members);
      toast({ title: `Imported ${members.length} members from CSV` });
    }
    e.target.value = '';
  };

  const handleSaveLimit = async (memberId: string) => {
    const cents = limitValue ? Math.round(parseFloat(limitValue) * 100) : null;
    await teamAdmin.updateMemberSpendingLimit(memberId, cents);
    setEditingLimit(null);
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="flex-1 min-w-[180px]" />
        <Input placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} className="w-32" />
        <select className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={newRole} onChange={e => setNewRole(e.target.value)}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
          <option value="viewer">Viewer</option>
        </select>
        <Button onClick={handleAddMember} size="sm" className="gap-1"><Plus className="w-3 h-3" /> Add</Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1">
          <Upload className="w-3 h-3" /> CSV
        </Button>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
      </div>

      <p className="text-xs text-muted-foreground">CSV format: email, name, role (one per line with header row)</p>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Spending Limit</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamAdmin.members.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No members yet</TableCell></TableRow>
            ) : teamAdmin.members.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.display_name || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{m.email || '—'}</TableCell>
                <TableCell><Badge variant="outline">{m.role}</Badge></TableCell>
                <TableCell>
                  {editingLimit === m.id ? (
                    <div className="flex gap-1 items-center">
                      <DollarSign className="w-3 h-3 text-muted-foreground" />
                      <Input className="h-7 w-20" value={limitValue} onChange={e => setLimitValue(e.target.value)} placeholder="0.00" />
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleSaveLimit(m.id)}>Save</Button>
                    </div>
                  ) : (
                    <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => { setEditingLimit(m.id); setLimitValue(m.spending_limit_cents ? (m.spending_limit_cents / 100).toFixed(2) : ''); }}>
                      {m.spending_limit_cents ? `$${(m.spending_limit_cents / 100).toFixed(2)}` : 'No limit'}
                    </button>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => teamAdmin.removeMember(m.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
