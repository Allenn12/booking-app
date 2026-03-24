import React from 'react';
import { AlertCircle, CalendarRange, X } from 'lucide-react';
import { Button } from '../ui/button';
import { useNavigate } from 'react-router-dom';

export function ConflictWarningPanel({ conflicts = [], onDismiss }) {
  const navigate = useNavigate();

  if (!conflicts || conflicts.length === 0) return null;

  const handleGoToCalendar = () => {
    // Dismiss the panel (and optionally close modal from parent, handled below)
    onDismiss();
    navigate('/calendar');
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 relative">
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-2 right-2 h-6 w-6 text-amber-600 hover:text-amber-800 hover:bg-amber-100"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="flex gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <h4 className="font-medium text-amber-800 mb-1">Schedule Conflicts Detected</h4>
          <p className="text-sm text-amber-700 mb-3">
            The changes you just saved conflict with {conflicts.length} existing {conflicts.length === 1 ? 'appointment' : 'appointments'}.
            Affected appointments must be manually rescheduled.
          </p>
          
          <ul className="space-y-1 mb-4">
            {conflicts.slice(0, 5).map((conflict, i) => {
              const dateStr = new Date(conflict.appointmentDatetime).toLocaleString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              });
              return (
                <li key={i} className="text-sm text-amber-800 flex items-start">
                  <span className="mr-2">•</span>
                  <span>
                    <strong>{conflict.clientName}</strong> on {dateStr}
                    {conflict.message && <span className="opacity-80 ml-1">({conflict.message})</span>}
                  </span>
                </li>
              );
            })}
            {conflicts.length > 5 && (
              <li className="text-sm text-amber-800 italic ml-2">
                ...and {conflicts.length - 5} more
              </li>
            )}
          </ul>

          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              className="bg-white border-amber-300 text-amber-800 hover:bg-amber-100"
              onClick={handleGoToCalendar}
            >
              <CalendarRange className="h-4 w-4 mr-2" />
              Go to Calendar to Reschedule
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              className="text-amber-800 hover:bg-amber-100"
              onClick={onDismiss}
            >
              Dismiss Warning
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
