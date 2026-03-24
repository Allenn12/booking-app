import React from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export function BreaksList({ breaks = [], onChange, disabled = false }) {
  
  const addBreak = () => {
    onChange([...breaks, { start_time: '', end_time: '' }]);
  };

  const removeBreak = (index) => {
    const newBreaks = [...breaks];
    newBreaks.splice(index, 1);
    onChange(newBreaks);
  };

  const updateBreak = (index, field, value) => {
    const newBreaks = [...breaks];
    newBreaks[index] = { ...newBreaks[index], [field]: value };
    onChange(newBreaks);
  };

  if (!breaks || breaks.length === 0) {
    return (
      <div className="flex justify-start py-1">
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          onClick={addBreak} 
          disabled={disabled}
          className="h-8 text-xs text-muted-foreground hover:text-primary"
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Break
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 relative pl-8 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[2px] before:bg-border/50">
      {breaks.map((brk, index) => {
        // Simple visual validation
        const hasBoth = brk.start_time && brk.end_time;
        const isInvalid = hasBoth && brk.start_time >= brk.end_time;
        
        return (
          <div key={index} className="flex items-center gap-2 relative">
            {/* Connection dot */}
            <div className="absolute -left-[1.375rem] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-background bg-muted-foreground" />
            
            <div className={`flex items-center gap-2 ${isInvalid ? 'text-destructive focus-within:text-destructive' : ''}`}>
              <Input
                type="time"
                value={brk.start_time || ''}
                onChange={(e) => updateBreak(index, 'start_time', e.target.value)}
                disabled={disabled}
                className={`w-[110px] h-9 ${isInvalid ? 'border-destructive' : ''}`}
                step={900}
              />
              <span className="text-muted-foreground text-sm">-</span>
              <Input
                type="time"
                value={brk.end_time || ''}
                onChange={(e) => updateBreak(index, 'end_time', e.target.value)}
                disabled={disabled}
                className={`w-[110px] h-9 ${isInvalid ? 'border-destructive' : ''}`}
                step={900}
              />
            </div>
            
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeBreak(index)}
              disabled={disabled}
              className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
              title="Remove break"
            >
              <X className="h-4 w-4" />
            </Button>
            
            {isInvalid && (
              <span className="text-xs text-destructive">Invalid time range</span>
            )}
          </div>
        );
      })}
      
      <div className="flex justify-start">
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          onClick={addBreak} 
          disabled={disabled}
          className="h-8 text-xs text-muted-foreground hover:text-primary mt-1"
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Another Break
        </Button>
      </div>
    </div>
  );
}
