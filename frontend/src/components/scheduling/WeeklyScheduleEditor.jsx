import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Save } from 'lucide-react';
import api from '../../api/client';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { DayRow } from './DayRow';
import { toast } from 'sonner';

const DAYS = [
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
  { id: 7, label: 'Sunday' },
];

export function WeeklyScheduleEditor({ 
  businessId, 
  userId, 
  businessHours, 
  isAdmin, 
  onConflicts,
  onDirtyChange
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Original fetched data
  const [originalSchedule, setOriginalSchedule] = useState([]);
  
  // Draft being modified
  const [draft, setDraft] = useState({});
  // Baseline loaded draft for accurate dirty state
  const [baseDraft, setBaseDraft] = useState({});

  useEffect(() => {
    fetchSchedule();
  }, [businessId, userId]);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const res = await api.getSchedule(businessId, userId);
      const rows = res.data || [];
      
      setOriginalSchedule(rows);
      initializeDraft(rows, businessHours);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch schedule');
    } finally {
      setLoading(false);
    }
  };

  const initializeDraft = (existingRows, bizHours) => {
    const newDraft = {};
    
    DAYS.forEach(day => {
      // Find explicit schedule row
      const existing = existingRows.find(r => r.day_of_week === day.id);
      if (existing) {
        newDraft[day.id] = { ...existing };
        return;
      }
      
      // Fallback: look at business hours
      const bizDay = bizHours?.find(bh => bh.day_of_week === day.id);
      if (bizDay && !bizDay.is_closed) {
        newDraft[day.id] = {
          day_of_week: day.id,
          is_day_off: false,
          start_time: bizDay.open_time.substring(0, 5),
          end_time: bizDay.close_time.substring(0, 5),
          breaks: []
        };
      } else {
        newDraft[day.id] = {
          day_of_week: day.id,
          is_day_off: true,
          start_time: '09:00',
          end_time: '17:00',
          breaks: []
        };
      }
    });

    setDraft(newDraft);
    setBaseDraft(JSON.parse(JSON.stringify(newDraft)));
    onDirtyChange?.(false);
  };

  const handleDayChange = (dayId, newData) => {
    setDraft(prev => ({
      ...prev,
      [dayId]: newData
    }));
  };

  const handleCopyMonToFri = () => {
    const monday = draft[1];
    if (!monday) return;

    setDraft(prev => {
      const next = { ...prev };
      for (let i = 2; i <= 5; i++) {
        next[i] = {
          ...monday,
          id: next[i]?.id, // keep the db id if amending existing
          day_of_week: i,
          breaks: monday.breaks.map(b => ({ start_time: b.start_time, end_time: b.end_time }))
        };
      }
      return next;
    });
    toast.success('Copied Monday\'s schedule to Tue-Fri');
  };

  const hasChanges = useMemo(() => {
    if (loading || !baseDraft || Object.keys(baseDraft).length === 0) return false;
    for (const day of DAYS) {
      const d = draft[day.id];
      const b = baseDraft[day.id];
      if (!d || !b) continue;
      if (d.is_day_off !== b.is_day_off ||
          d.start_time !== b.start_time ||
          d.end_time !== b.end_time ||
          JSON.stringify(d.breaks || []) !== JSON.stringify(b.breaks || [])) {
        return true;
      }
    }
    return false;
  }, [draft, baseDraft, loading]);

  const handleSave = async () => {
    if (!isAdmin) return;
    
    setSaving(true);
    const allWarnings = [];
    let hasError = false;

    // Diff algorithm:
    // A day is "existing" if draft[day].id exists.
    try {
      // Create an array of Promises so we execute sequentially or parallel?
      // Better sequentially so we don't bombard the poor DB.
      for (const day of DAYS) {
        const d = draft[day.id];
        const orig = originalSchedule.find(r => r.day_of_week === day.id);
        
        // Prepare payload correctly
        const payload = {
          day_of_week: d.day_of_week,
          start_time: d.start_time,
          end_time: d.end_time,
          is_day_off: d.is_day_off,
          breaks: d.breaks || []
        };

        if (d.id) {
          // Existed before
          // If it was modified (we could deep compare, but safe to just PUT)
          const res = await api.updateScheduleRow(businessId, userId, d.id, payload);
          if (res.warnings?.length > 0) allWarnings.push(...res.warnings);
        } else {
          // Did not exist. If it is a day off, do we even create a row? 
          // Usually a day_off row is needed to explicitly override business hours, so yes!
          const res = await api.createScheduleRow(businessId, userId, payload);
          if (res.warnings?.length > 0) allWarnings.push(...res.warnings);
        }
      }

      toast.success('Schedule saved successfully');
      onDirtyChange?.(false);
      
      // Pass warnings up to parent if any
      if (allWarnings.length > 0) {
        onConflicts?.(allWarnings);
      }
      
      // Refresh to get actual IDs
      await fetchSchedule();
      
    } catch (err) {
      toast.error(err.message || 'Failed to save schedule');
      hasError = true;
    } finally {
      setSaving(false);
    }
  };

  // Provide deep diff for accurate hasChanges flag
  useEffect(() => {
    if (loading || !baseDraft || Object.keys(baseDraft).length === 0) return;
    let isDirty = false;
    
    for (const day of DAYS) {
      const d = draft[day.id];
      const b = baseDraft[day.id];
      
      if (!d || !b) continue;

      const hasDayChange = 
        d.is_day_off !== b.is_day_off ||
        d.start_time !== b.start_time ||
        d.end_time !== b.end_time ||
        JSON.stringify(d.breaks || []) !== JSON.stringify(b.breaks || []);

      if (hasDayChange) {
        isDirty = true;
      }
    }
    onDirtyChange?.(isDirty);
  }, [draft, baseDraft, loading]);

  if (loading) {
    return (
      <div className="space-y-4 mt-6">
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const isUsingDefaults = originalSchedule.length === 0;

  return (
    <div className="space-y-6 mt-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Regular Schedule</h3>
          {isUsingDefaults && (
            <p className="text-sm text-amber-600 mt-1">
              No schedule set. Displaying default business hours.
            </p>
          )}
          {!isUsingDefaults && (
            <p className="text-sm text-muted-foreground mt-1">
              Manage regular weekly working hours and breaks.
            </p>
          )}
        </div>
        
        {isAdmin && (
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={handleCopyMonToFri}
              title="Copy Monday hours to Tuesday through Friday"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Mon to Tue-Fri
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {DAYS.map(day => (
          <DayRow 
            key={day.id}
            dayLabel={day.label}
            dayData={draft[day.id] || { day_of_week: day.id, is_day_off: true, breaks: [] }}
            onChange={(newData) => handleDayChange(day.id, newData)}
            isAdmin={isAdmin}
          />
        ))}
      </div>

      {isAdmin && (
        <div className="flex justify-end pt-4 border-t border-border mt-6">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full sm:w-auto"
            data-dirty={hasChanges}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Schedule'}
            <span className="ml-1 text-primary-foreground/70 hidden data-[dirty=true]:inline">•</span>
          </Button>
        </div>
      )}
    </div>
  );
}
