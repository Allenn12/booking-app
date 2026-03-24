import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CalendarX2, X } from 'lucide-react';
import api from '../../api/client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Skeleton } from '../ui/skeleton';
import { BreaksList } from './BreaksList';
import { toast } from 'sonner';

export function ExceptionsTab({ businessId, userId, isAdmin, onConflicts }) {
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    exception_date: '',
    is_day_off: true,
    start_time: '09:00',
    end_time: '17:00',
    reason: '',
    breaks: []
  });

  useEffect(() => {
    fetchExceptions();
  }, [businessId, userId]);

  const fetchExceptions = async () => {
    try {
      setLoading(true);
      const res = await api.getExceptions(businessId, userId);
      setExceptions(res.data || []);
    } catch (err) {
      toast.error('Failed to load exceptions');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) return;
    try {
      await api.deleteException(businessId, userId, id);
      toast.success('Exception removed');
      fetchExceptions();
    } catch (err) {
      toast.error('Failed to remove exception');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!formData.exception_date) {
      return toast.error('Date is required');
    }

    try {
      setSaving(true);
      const payload = {
        exception_date: formData.exception_date,
        is_day_off: formData.is_day_off,
        reason: formData.reason,
        start_time: formData.is_day_off ? null : formData.start_time,
        end_time: formData.is_day_off ? null : formData.end_time,
        breaks: formData.is_day_off ? [] : (formData.breaks || [])
      };

      const res = await api.createException(businessId, userId, payload);
      
      toast.success('Exception created');
      setShowForm(false);
      setFormData({
        exception_date: '',
        is_day_off: true,
        start_time: '09:00',
        end_time: '17:00',
        reason: '',
        breaks: []
      });
      fetchExceptions();

      if (res.warnings?.length > 0) {
        onConflicts?.(res.warnings);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to create exception');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (ds) => {
    const d = new Date(ds);
    return new Intl.DateTimeFormat('en-GB', { 
      day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' 
    }).format(d);
  };

  return (
    <div className="space-y-6 mt-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Specific Date Overrides</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Set custom hours or days off for specific dates that differ from the regular schedule.
          </p>
        </div>
        
        {isAdmin && !showForm && (
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Exception
          </Button>
        )}
      </div>

      {showForm && isAdmin && (
        <div className="bg-muted/30 border rounded-lg p-5 relative mt-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="absolute right-2 top-2 h-8 w-8 p-0" 
            onClick={() => setShowForm(false)}
            type="button"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
          
          <h4 className="font-medium mb-4">New Exception</h4>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input 
                  type="date" 
                  required
                  value={formData.exception_date}
                  onChange={e => setFormData({...formData, exception_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Reason (Optional)</Label>
                <Input 
                  placeholder="e.g. Doctor appointment, Training"
                  value={formData.reason}
                  onChange={e => setFormData({...formData, reason: e.target.value})}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Switch 
                id="exception-day-off"
                checked={!formData.is_day_off}
                onCheckedChange={(working) => setFormData({...formData, is_day_off: !working})}
              />
              <Label htmlFor="exception-day-off">Working this day</Label>
            </div>

            {!formData.is_day_off && (
              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>Working Hours</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="time" 
                      value={formData.start_time}
                      onChange={e => setFormData({...formData, start_time: e.target.value})}
                      required
                      step={900}
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input 
                      type="time" 
                      value={formData.end_time}
                      onChange={e => setFormData({...formData, end_time: e.target.value})}
                      required
                      step={900}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Breaks</Label>
                  <BreaksList 
                    breaks={formData.breaks}
                    onChange={(newB) => setFormData({...formData, breaks: newB})}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="mr-2">
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                Save Exception
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
        ) : exceptions.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
            <CalendarX2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p>No upcoming exceptions.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Reason</TableHead>
                {isAdmin && <TableHead className="w-[80px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions.map(exc => (
                <TableRow key={exc.id}>
                  <TableCell className="font-medium">{formatDate(exc.exception_date)}</TableCell>
                  <TableCell>
                    {exc.is_day_off ? (
                      <span className="text-muted-foreground">Day Off</span>
                    ) : (
                      <span>{exc.start_time?.substring(0,5)} - {exc.end_time?.substring(0,5)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{exc.reason || '-'}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(exc.id)}
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
