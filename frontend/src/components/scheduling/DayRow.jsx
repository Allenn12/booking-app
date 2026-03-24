import React from 'react';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { BreaksList } from './BreaksList';

export function DayRow({ 
  dayLabel, 
  dayData, 
  onChange, 
  isAdmin = false 
}) {
  const isWorking = !dayData.is_day_off;
  const disabled = !isAdmin;

  const handleToggleWork = (checked) => {
    onChange({
      ...dayData,
      is_day_off: !checked,
      // Provide some default hours if switching to working and currently empty
      start_time: !checked ? (dayData.start_time || '09:00') : dayData.start_time,
      end_time: !checked ? (dayData.end_time || '17:00') : dayData.end_time,
      breaks: dayData.breaks || []
    });
  };

  const handleTimeChange = (field, value) => {
    onChange({
      ...dayData,
      [field]: value
    });
  };

  const handleBreaksChange = (newBreaks) => {
    onChange({
      ...dayData,
      breaks: newBreaks
    });
  };

  const hasBothTimes = dayData.start_time && dayData.end_time;
  const isInvalidTime = hasBothTimes && dayData.start_time >= dayData.end_time;

  return (
    <div className={`p-4 border rounded-lg transition-colors ${!isWorking ? 'bg-muted/30 border-dashed' : 'bg-card border-border shadow-sm'}`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        
        {/* Left Column: Label & Switch */}
        <div className="w-[140px] flex items-center gap-3 shrink-0 pt-1">
          <Switch 
            checked={isWorking}
            onCheckedChange={handleToggleWork}
            disabled={disabled}
            id={`switch-${dayLabel}`}
          />
          <Label 
            htmlFor={`switch-${dayLabel}`}
            className={`text-base cursor-pointer ${!isWorking ? 'text-muted-foreground' : 'font-medium'}`}
          >
            {dayLabel}
          </Label>
        </div>

        {/* Right Column: Content */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {!isWorking ? (
            <div className="flex items-center h-9">
              <Badge variant="outline" className="text-muted-foreground bg-muted">Day Off</Badge>
            </div>
          ) : (
            <>
              {/* Working Hours Input */}
              <div className="flex items-center flex-wrap gap-2">
                <div className={`flex items-center gap-2 ${isInvalidTime ? 'text-destructive focus-within:text-destructive' : ''}`}>
                  <Input
                    type="time"
                    value={dayData.start_time || ''}
                    onChange={(e) => handleTimeChange('start_time', e.target.value)}
                    disabled={disabled}
                    className={`w-[120px] ${isInvalidTime ? 'border-destructive' : ''}`}
                    step={900}
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="time"
                    value={dayData.end_time || ''}
                    onChange={(e) => handleTimeChange('end_time', e.target.value)}
                    disabled={disabled}
                    className={`w-[120px] ${isInvalidTime ? 'border-destructive' : ''}`}
                    step={900}
                  />
                </div>
                {isInvalidTime && (
                  <span className="text-xs text-destructive ml-2">End time must be after start time</span>
                )}
              </div>

              {/* Breaks Section */}
              <BreaksList 
                breaks={dayData.breaks || []} 
                onChange={handleBreaksChange}
                disabled={disabled}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
