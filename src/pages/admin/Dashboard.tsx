/**
 * TEMPORARY DEVELOPMENT PAGE - REMOVE BEFORE PRODUCTION
 * 
 * Admin Dashboard for testing and monitoring during development
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Users, Calendar, TrendingUp, Activity, ExternalLink } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function AdminDashboard() {
  const { isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState<any[]>([]);
  const [recentSlots, setRecentSlots] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalMerchants: 0,
    totalSlots: 0,
    totalBookings: 0,
    totalConsumers: 0,
  });

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/merchant/dashboard');
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      // Get merchants
      const { data: merchantsData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      setMerchants(merchantsData || []);

      // Get recent slots with merchant info
      const { data: slotsData } = await supabase
        .from('slots')
        .select(`
          *,
          profiles:merchant_id (business_name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentSlots(slotsData || []);

      // Get stats
      const [slotsCount, bookingsCount, consumersCount] = await Promise.all([
        supabase.from('slots').select('*', { count: 'exact', head: true }),
        supabase.from('slots').select('*', { count: 'exact', head: true }).eq('status', 'booked'),
        supabase.from('consumers').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        totalMerchants: merchantsData?.length || 0,
        totalSlots: slotsCount.count || 0,
        totalBookings: bookingsCount.count || 0,
        totalConsumers: consumersCount.count || 0,
      });
    };

    fetchData();
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background p-6 lg:pl-72">
      <div className="max-w-7xl mx-auto space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Development Mode:</strong> This admin panel is for testing only. Remove before production deployment.
          </AlertDescription>
        </Alert>

        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">System-wide overview and monitoring</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Merchants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMerchants}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Slots</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSlots}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBookings}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Consumers</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalConsumers}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Slots */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Slots</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Booked By</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSlots.map((slot) => (
                  <TableRow key={slot.id}>
                    <TableCell className="font-medium">
                      {slot.profiles?.business_name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {new Date(slot.start_time).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={slot.status === 'booked' ? 'default' : 'outline'}>
                        {slot.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{slot.booked_by_name || '-'}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(slot.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Merchants Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Merchants</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Booking URL</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {merchants.map((merchant) => (
                  <TableRow key={merchant.id}>
                    <TableCell className="font-medium">{merchant.business_name}</TableCell>
                    <TableCell>{merchant.phone}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(merchant.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {merchant.booking_url ? (
                        <a 
                          href={merchant.booking_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => navigate(`/notify/${merchant.id}`)}
                      >
                        View Public Page
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
