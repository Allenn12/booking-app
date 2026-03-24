import React, { createContext, useState, useRef, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

export const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState({
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    confirmVariant: 'default', // 'default' | 'destructive'
  });
  
  const resolveRef = useRef(null);

  const confirm = useCallback((opts) => {
    if (open) return Promise.resolve(false);

    setOptions({
      title: opts.title || 'Are you sure?',
      description: opts.description || '',
      confirmLabel: opts.confirmLabel || 'Confirm',
      cancelLabel: opts.cancelLabel || 'Cancel',
      confirmVariant: opts.confirmVariant || 'default'
    });
    setOpen(true);
    
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, [open]);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    if (resolveRef.current) {
      resolveRef.current(true);
      resolveRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
  }, []);

  // Use the button variant system from Shadcn UI if we were fully integrating it into the action,
  // but Shadcn's AlertDialogAction by default uses the primary button style.
  // We can pass the className to make it destructive.
  const confirmButtonClass = options.confirmVariant === 'destructive' 
    ? 'bg-red-600 text-white hover:bg-red-700' 
    : '';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {options.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              {options.cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className={confirmButtonClass}>
              {options.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
};
