import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/modal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { WeeklyScheduleEditor } from './WeeklyScheduleEditor';
import { ExceptionsTab } from './ExceptionsTab';
import { TimeOffTab } from './TimeOffTab';
import { ConflictWarningPanel } from './ConflictWarningPanel';
import { useConfirm } from '../../hooks/useConfirm';

export function ScheduleModal({ 
  isOpen, 
  onClose, 
  userId, 
  userName, 
  businessId, 
  businessHours, 
  isAdmin 
}) {
  const [hasChanges, setHasChanges] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const { confirm } = useConfirm();

  // Reset state when modal opens for a new user
  useEffect(() => {
    if (isOpen) {
      setHasChanges(false);
      setConflicts([]);
    }
  }, [isOpen, userId]);

  const handleCloseAttempt = async () => {
    if (hasChanges) {
      const ok = await confirm({
        title: 'Discard changes?',
        description: 'Your schedule changes have not been saved.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        confirmVariant: 'destructive',
      });
      if (!ok) return;
    }
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleCloseAttempt} 
      title={`Schedule — ${userName}`} 
      size="lg"
    >
      <div className="flex flex-col h-full min-h-[500px]">
        <ConflictWarningPanel 
          conflicts={conflicts} 
          onDismiss={() => setConflicts([])} 
        />
        
        <Tabs defaultValue="weekly" className="flex flex-col flex-1">
          <TabsList className="grid w-full grid-cols-3 mb-2">
            <TabsTrigger value="weekly">Weekly Schedule</TabsTrigger>
            <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
            <TabsTrigger value="timeoff">Time Off</TabsTrigger>
          </TabsList>
          
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <TabsContent value="weekly" className="m-0 mt-2">
              <WeeklyScheduleEditor 
                businessId={businessId} 
                userId={userId} 
                businessHours={businessHours} 
                isAdmin={isAdmin}
                onConflicts={setConflicts}
                onDirtyChange={setHasChanges}
              />
            </TabsContent>
            
            <TabsContent value="exceptions" className="m-0 mt-2">
              <ExceptionsTab 
                businessId={businessId} 
                userId={userId} 
                isAdmin={isAdmin}
                onConflicts={setConflicts}
              />
            </TabsContent>
            
            <TabsContent value="timeoff" className="m-0 mt-2">
              <TimeOffTab 
                businessId={businessId} 
                userId={userId} 
                isAdmin={isAdmin}
                onConflicts={setConflicts}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </Modal>
  );
}
