import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { DollarSign, Users, Brain, Code } from 'lucide-react';
import type { useTeamAdmin } from '@/hooks/useTeamAdmin';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2, 280 60% 55%))', 'hsl(var(--chart-3, 200 70% 50%))', 'hsl(var(--chart-4, 40 90% 55%))', 'hsl(var(--chart-5, 350 70% 55%))'];

interface Props {
  teamAdmin: ReturnType<typeof useTeamAdmin>;
}

export const TeamAnalyticsTab = ({ teamAdmin }: Props) => {
  const [view, setView] = useState<'person' | 'overall'>('overall');

  const totalSpending = useMemo(() =>
    teamAdmin.spending.reduce((sum, s) => sum + s.amount_cents, 0) / 100,
  [teamAdmin.spending]);

  const spendingByPerson = useMemo(() => {
    const map = new Map<string, number>();
    teamAdmin.spending.forEach(s => {
      const name = teamAdmin.members.find(m => m.user_id === s.user_id)?.display_name || s.user_id.slice(0, 8);
      map.set(name, (map.get(name) || 0) + s.amount_cents / 100);
    });
    return Array.from(map.entries()).map(([name, amount]) => ({ name, amount }));
  }, [teamAdmin.spending, teamAdmin.members]);

  const spendingByCategory = useMemo(() => {
    const map = new Map<string, number>();
    teamAdmin.spending.forEach(s => {
      map.set(s.category, (map.get(s.category) || 0) + s.amount_cents / 100);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [teamAdmin.spending]);

  const spendingOverTime = useMemo(() => {
    const map = new Map<string, number>();
    teamAdmin.spending.forEach(s => {
      const day = new Date(s.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      map.set(day, (map.get(day) || 0) + s.amount_cents / 100);
    });
    return Array.from(map.entries()).map(([date, amount]) => ({ date, amount })).reverse();
  }, [teamAdmin.spending]);

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total Spend</p>
              <p className="text-lg font-bold">${totalSpending.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Members</p>
              <p className="text-lg font-bold">{teamAdmin.members.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">AI Requests</p>
              <p className="text-lg font-bold">{teamAdmin.spending.filter(s => s.category === 'ai').length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <Code className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Policies</p>
              <p className="text-lg font-bold">{teamAdmin.policies.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Badge variant={view === 'overall' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setView('overall')}>Overall</Badge>
        <Badge variant={view === 'person' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setView('person')}>Per Person</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {view === 'person' ? (
          <Card>
            <CardHeader className="p-3 pb-1"><CardTitle className="text-sm">Spending by Person</CardTitle></CardHeader>
            <CardContent className="p-3 h-60">
              {spendingByPerson.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No spending data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spendingByPerson}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="p-3 pb-1"><CardTitle className="text-sm">Spending Over Time</CardTitle></CardHeader>
            <CardContent className="p-3 h-60">
              {spendingOverTime.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No spending data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spendingOverTime}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-sm">Spending by Category</CardTitle></CardHeader>
          <CardContent className="p-3 h-60">
            {spendingByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={spendingByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: $${value.toFixed(0)}`}>
                    {spendingByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
