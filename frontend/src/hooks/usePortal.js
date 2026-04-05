/**
 * usePortal — Customer Portal State Hook
 * ========================================
 * Encapsulates all data fetching and mutation logic for the customer portal.
 * Keeps the page component thin and purely presentational.
 *
 * Patterns:
 * - useReducer for complex multi-field state transitions
 * - useCallback for stable function references
 * - Optimistic UI: remove cancelled appointment from list immediately,
 *   revert on error
 */

import { useReducer, useEffect, useCallback } from 'react';
import api from '../api/client';

// ── State shape ──────────────────────────────────────────────────────────────
const initialState = {
  loading:       true,
  error:         null,
  customer:      null,
  business:      null,
  upcoming:      [],
  past:          [],
  // Cancel flow per-appointment
  cancelingId:   null,   // appointment ID currently being cancelled
  cancelError:   null,   // error from last cancel attempt
  cancelDone:    null,   // appointment ID just successfully cancelled
};

// ── Reducer ──────────────────────────────────────────────────────────────────
function portalReducer(state, action) {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };

    case 'FETCH_SUCCESS':
      return {
        ...state,
        loading:  false,
        error:    null,
        customer: action.payload.customer,
        business: action.payload.business,
        upcoming: action.payload.appointments.upcoming,
        past:     action.payload.appointments.past,
      };

    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.payload };

    case 'CANCEL_START':
      return { ...state, cancelingId: action.payload, cancelError: null, cancelDone: null };

    case 'CANCEL_SUCCESS': {
      // Optimistic: remove from upcoming, keep cancelled done ID
      const cancelledId = action.payload;
      return {
        ...state,
        cancelingId: null,
        cancelDone:  cancelledId,
        upcoming:    state.upcoming.filter(a => a.id !== cancelledId),
      };
    }

    case 'CANCEL_ERROR':
      return { ...state, cancelingId: null, cancelError: action.payload };

    case 'CLEAR_CANCEL_DONE':
      return { ...state, cancelDone: null };

    case 'CLEAR_CANCEL_ERROR':
      return { ...state, cancelError: null };

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function usePortal(token) {
  const [state, dispatch] = useReducer(portalReducer, initialState);

  // ── Fetch portal data ────────────────────────────────────────────────────
  const fetchPortal = useCallback(async () => {
    if (!token) {
      dispatch({ type: 'FETCH_ERROR', payload: 'Invalid portal link.' });
      return;
    }
    dispatch({ type: 'FETCH_START' });
    try {
      const res = await api.getPortal(token);
      if (res.success) {
        dispatch({ type: 'FETCH_SUCCESS', payload: res.data });
      } else {
        dispatch({ type: 'FETCH_ERROR', payload: res.error || 'Failed to load portal.' });
      }
    } catch (err) {
      const msg = err.status === 404
        ? 'Ovaj portal link nije ispravan ili je deaktiviran.'
        : (err.message || 'Greška pri učitavanju portala.');
      dispatch({ type: 'FETCH_ERROR', payload: msg });
    }
  }, [token]);

  useEffect(() => {
    fetchPortal();
  }, [fetchPortal]);

  // ── Cancel appointment ───────────────────────────────────────────────────
  const cancelAppointment = useCallback(async (appointmentId) => {
    dispatch({ type: 'CANCEL_START', payload: appointmentId });
    try {
      await api.cancelPortalAppointment(token, appointmentId);
      dispatch({ type: 'CANCEL_SUCCESS', payload: appointmentId });
    } catch (err) {
      const msg = err.message || 'Nije moguće otkazati termin.';
      dispatch({ type: 'CANCEL_ERROR', payload: msg });
    }
  }, [token]);

  const clearCancelDone  = useCallback(() => dispatch({ type: 'CLEAR_CANCEL_DONE' }),  []);
  const clearCancelError = useCallback(() => dispatch({ type: 'CLEAR_CANCEL_ERROR' }), []);

  return {
    ...state,
    cancelAppointment,
    clearCancelDone,
    clearCancelError,
    refetch: fetchPortal,
  };
}
