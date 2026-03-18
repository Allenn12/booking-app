import { useState, useEffect } from 'react';

/**
 * Debounce a value by a specified delay.
 * Returns the debounced value — only updates after `delay` ms of inactivity.
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
