import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Plane } from 'lucide-react';
import api from '../../api/client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';

export function TimeOffTab({ businessId, userId, isAdmin, onConflicts }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    type: 'vacation',
    status: 'approved', // Defaulting to approved for admins adding it directly
    note: ''
  });

  useEffect(() => {
    fetchTimeOff();
  }, [businessId, userId]);

  const fetchTimeOff = async () => {
    try {
      setLoading(true);
      const res = await api.getTimeOff(businessId, userId);
      setRecords(res.data || []);
    } catch (err) {
      toast.error('Failed to load time off records');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) return;
    try {
      await api.deleteTimeOff(businessId, userId, id);
      toast.success('Time off removed');
      fetchTimeOff();
    } catch (err) {
      toast.error('Failed to remove time off');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!formData.start_date || !formData.end_date) {
      return toast.error('Start and end dates are required');
    }
    
    if (formData.start_date > formData.end_date) {
      return toast.error('End date must be after start date');
    }

    try {
      setSaving(true);
      const res = await api.createTimeOff(businessId, userId, formData);
      
      toast.success('Time off created');
      setShowForm(false);
      setFormData({
        start_date: '',
        end_date: '',
        type: 'vacation',
        status: 'approved',
        note: ''
      });
      fetchTimeOff();

      if (res.warnings?.length > 0) {
        onConflicts?.(res.warnings);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to create time off');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (ds) => {
    const d = new Date(ds);
    return new Intl.DateTimeFormat('en-GB', { 
      day: 'numeric', month: 'short', year: 'numeric'
    }).format(d);
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'vacation': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'sick_leave': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'personal': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTypeLabel = (type) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="space-y-6 mt-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Time Off & Vacations</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Manage extended absences like vacations, sick leave, or personal days.
          </p>
        </div>
        
        {isAdmin && !showForm && (
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Time Off
          </Button>
        )}
      </div>

      {showForm && isAdmin && (
        <div className="bg-muted/30 border rounded-lg p-5 mt-4">
          <h4 className="font-medium mb-4">Register Time Off</h4>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input 
                  type="date" 
                  required
                  value={formData.start_date}
                  onChange={e => setFormData({...formData, start_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input 
                  type="date" 
                  required
                  value={formData.end_date}
                  onChange={e => setFormData({...formData, end_date: e.target.value})}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  required
                >
                  <option value="vacation">Vacation</option>
                  <option value="sick_leave">Sick Leave</option>
                  <option value="personal">Personal Reason</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value})}
                  required
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Note (Optional)</Label>
              <Input 
                placeholder="Details about the absence"
                value={formData.note}
                onChange={e => setFormData({...formData, note: e.target.value})}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="mr-2">
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                Add Record
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="border rounded-md mt-4">
        {loading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : records.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
            <Plane className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p>No time off records found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Range</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-[80px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map(rec => (
                <TableRow key={rec.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {formatDate(rec.start_date)} - {formatDate(rec.end_date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getTypeColor(rec.type)}>
                      {formatTypeLabel(rec.type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(rec.status)}>
                      {formatTypeLabel(rec.status)}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(rec.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
