import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Package, ShoppingCart, FlaskConical, ClipboardCheck, Building2, RefreshCw, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { itemVariants, containerVariants } from '@/components/PageTransition';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/useProject';
import { useAuth } from '@/contexts/useAuth';
import { api } from '@/lib/api';

const formatRelativeTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
};

const activityInitials = (name) => {
  const value = String(name || 'NA').trim();
  if (!value) return 'NA';
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedProject } = useProject();
  const { user } = useAuth();

  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const projectId = selectedProject?.id || selectedProject?.project_id;
  const userId = user?.user_id || user?.id || user?.uid;

  const loadData = async ({ silent = false } = {}) => {
    try {
      if (userId == null || userId === '') {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [statsResult, activityResult] = await Promise.all([
        api.getDashboardStats(projectId ? { projectId } : {}),
        api.getDashboardActivity({ userId, projectId, limit: 8, offset: 0 }),
      ]);

      if (statsResult.success && statsResult.data?.success) {
        setStats(statsResult.data.stats || null);
      }

      if (activityResult.success && activityResult.data?.success) {
        setActivities(activityResult.data.activities || []);
      }
    } catch (error) {
      toast({
        title: 'Failed to load dashboard',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId, userId]);

  useEffect(() => {
    const wsUrl = api.getDashboardSocketUrl({ userId, token: user?.token });
    if (!wsUrl) return undefined;
    const ws = new WebSocket(wsUrl);
    let heartbeat = null;

    ws.onopen = () => {
      heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'INITIAL_ACTIVITIES' && Array.isArray(msg.data) && !projectId) {
          setActivities(msg.data);
        }
        if (msg.type === 'NEW_ACTIVITY' && msg.data) {
          if (projectId && String(msg.data.project_id) !== String(projectId)) return;
          setActivities((prev) => [msg.data, ...prev.filter((item) => item.id !== msg.data.id)].slice(0, 8));
        }
      } catch (error) {
        console.error('Invalid dashboard WS payload:', error);
      }
    };

    return () => {
      if (heartbeat) clearInterval(heartbeat);
      ws.close();
    };
  }, [projectId, userId, user?.token]);

  const cardData = useMemo(() => {
    const source = stats || {};
    const metric = (key) => {
      const value = source[key];
      if (typeof value === 'number') return { total: value, last30: null };
      return { total: Number(value?.total || 0), last30: value?.last_30_days ?? null };
    };

    return [
      { key: 'vendors', label: 'Vendors', icon: Building2, ...metric('vendors') },
      { key: 'pos', label: 'Purchase Orders', icon: ShoppingCart, ...metric('pos') },
      { key: 'samples', label: 'Samples', icon: FlaskConical, ...metric('samples') },
      { key: 'mirs', label: 'MIRs', icon: Package, ...metric('mirs') },
      { key: 'itrs', label: 'ITRs', icon: ClipboardCheck, ...metric('itrs') },
    ];
  }, [stats]);

  const chartData = useMemo(() => cardData.map((item) => ({
    name: item.label.replace('Purchase Orders', 'POs'),
    total: item.total,
  })), [cardData]);

  const handleRefresh = () => {
    loadData({ silent: true });
  };

  return (
    <motion.div
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {projectId ? `Live project metrics for ${selectedProject?.name || 'selected project'}.` : 'Live overall operational metrics.'}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-12 sm:h-10 flex-1 sm:flex-none px-4"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {cardData.map((item) => (
          <motion.div variants={itemVariants} key={item.key}>
            <Card className="border border-border/50 shadow-sm ring-1 ring-border/40 bg-card/60 backdrop-blur-sm dark:border-border/80 dark:ring-border/80 dark:shadow-[0_0_24px_hsl(var(--primary)/0.10)]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{item.label}</CardTitle>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-inner">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-foreground">
                  {loading ? '...' : item.total}
                </div>
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  {item.last30 == null ? 'No monthly delta available' : `${item.last30} added in last 30 days`}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid items-start gap-8 grid-cols-1 lg:grid-cols-7">
        <motion.div className="col-span-1 lg:col-span-4" variants={itemVariants}>
          <Card className="border border-border/50 shadow-lg ring-1 ring-border/40 dark:border-border/80 dark:ring-border/80 dark:shadow-[0_0_28px_hsl(var(--primary)/0.10)]">
            <CardHeader>
              <CardTitle>Entity Overview</CardTitle>
              <CardDescription>Totals by module based on current dashboard scope.</CardDescription>
            </CardHeader>
            <CardContent className="pl-0 sm:pl-2">
              <ResponsiveContainer width="100%" height={420}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderRadius: '12px',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div className="col-span-1 lg:col-span-3" variants={itemVariants}>
          <Card className="border border-border/50 shadow-lg ring-1 ring-border/40 dark:border-border/80 dark:ring-border/80 dark:shadow-[0_0_28px_hsl(var(--primary)/0.10)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                Recent Activity
              </CardTitle>
              <CardDescription>Latest actions from the activity stream.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading activity...</p>
              ) : activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity found for this scope.</p>
              ) : (
                <div className="max-h-[420px] overflow-y-auto pr-2 space-y-4">
                  {activities.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-card/60">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                        {activityInitials(item.performed_by_name || item.performed_by)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{item.performed_by_name || 'System'}</p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(item.created_at)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {`${item.action || 'updated'} ${item.entity_type || 'record'} ${item.entity_name || ''}`.trim()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

    </motion.div>
  );
}
