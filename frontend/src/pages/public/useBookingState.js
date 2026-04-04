import { useReducer, useEffect } from 'react';
import api from '@/api/client';

// Reducer actions
const ACTIONS = {
    INIT_SUCCESS: 'INIT_SUCCESS',
    INIT_ERROR: 'INIT_ERROR',
    SELECT_SERVICE: 'SELECT_SERVICE',
    SELECT_STAFF: 'SELECT_STAFF',
    SELECT_DATE: 'SELECT_DATE',
    SLOTS_LOADING: 'SLOTS_LOADING',
    SLOTS_LOADED: 'SLOTS_LOADED',
    SELECT_SLOT: 'SELECT_SLOT',
    SET_SCROLL_OFFSET: 'SET_SCROLL_OFFSET',
    UPDATE_CONTACT: 'UPDATE_CONTACT',
    GO_TO_STEP: 'GO_TO_STEP',
    SUBMIT_START: 'SUBMIT_START',
    SUBMIT_SUCCESS: 'SUBMIT_SUCCESS',
    SUBMIT_ERROR: 'SUBMIT_ERROR',
    CLEAR_ERROR: 'CLEAR_ERROR',
    NEXT_STEP: 'NEXT_STEP'
};

const initialState = {
    step: 1,
    loading: true,
    error: null,

    // Meta flags
    bookingDisabled: false,

    business: null,
    services: [],
    team: [],
    hours: [],

    selectedService: null,
    selectedStaff: null, 
    selectedDate: null, 
    selectedSlot: null,
    scrollOffset: 0,

    // Step 4 contact
    contactParams: {
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        notes: '',
        smsConsent: false
    },

    // Step 3 slots computation
    slots: [],
    slotsLoading: false,

    // Submission
    submitting: false,
    bookingResult: null,
};

function bookingReducer(state, action) {
    switch(action.type) {
        case ACTIONS.INIT_SUCCESS:
            return {
                ...state,
                loading: false,
                bookingDisabled: action.payload?.booking_disabled || false,
                business: action.payload?.business,
                services: action.payload?.services,
                team: action.payload?.team,
                hours: action.payload?.hours
            };
        case ACTIONS.INIT_ERROR:
            return { ...state, loading: false, error: action.payload };
        
        case ACTIONS.SELECT_SERVICE: {
            // Only clear downstream, don't auto-jump so the user can click Continue 
            // Staff auto-assignment is still prepared here or in NEXT_STEP
            const skipStaff = state.team && state.team.length === 1;
            return {
                ...state,
                selectedService: action.payload,
                // If skipping, pre-select the only staff member, else Bilo tko (null)
                selectedStaff: skipStaff ? state.team[0] : null,
                selectedDate: null,
                selectedSlot: null,
                slots: []
            };
        }
        case ACTIONS.SELECT_STAFF:
            return {
                ...state,
                selectedStaff: action.payload,
                // clear downstream
                selectedDate: null,
                selectedSlot: null,
                slots: []
            };
        case ACTIONS.SELECT_DATE:
            return {
                ...state,
                selectedDate: action.payload,
                selectedSlot: null, // user must pick a slot again
            };
        case ACTIONS.SLOTS_LOADING:
            return { ...state, slotsLoading: true, error: null };
        case ACTIONS.SLOTS_LOADED:
            return { ...state, slotsLoading: false, slots: action.payload };
        
        case ACTIONS.SELECT_SLOT:
            return {
                ...state,
                selectedSlot: action.payload,
                step: 4
            };
            
        case ACTIONS.SET_SCROLL_OFFSET:
            return { ...state, scrollOffset: action.payload };
            
        case ACTIONS.UPDATE_CONTACT:
            return {
                ...state,
                contactParams: { ...state.contactParams, ...action.payload }
            };

        case ACTIONS.GO_TO_STEP: {
            // "Promijeni" logic: Going back clears downstream selections depending on the target step
            if (action.payload >= state.step) return state; 
            
            const newState = { ...state, step: action.payload };
            if (action.payload === 1) {
                newState.selectedService = null;
                newState.selectedStaff = null;
                newState.selectedDate = null;
                newState.selectedSlot = null;
                newState.slots = [];
            } else if (action.payload === 2) {
                newState.selectedStaff = null;
                newState.selectedDate = null;
                newState.selectedSlot = null;
                newState.slots = [];
            } else if (action.payload === 3) {
                newState.selectedDate = null;
                newState.selectedSlot = null;
                newState.slots = [];
            }
            return newState;
        }
            
        case ACTIONS.SUBMIT_START:
             return { ...state, submitting: true, error: null };
             
        case ACTIONS.SUBMIT_SUCCESS:
            return { ...state, submitting: false, step: 6, bookingResult: action.payload };
            
        case ACTIONS.SUBMIT_ERROR:
            return { ...state, submitting: false, error: action.payload };
            
        case ACTIONS.CLEAR_ERROR:
            return { ...state, error: null };
        
        case ACTIONS.NEXT_STEP: {
            let next = state.step + 1;
            // Auto skip staff step if only 1 team member
            if (state.step === 1 && state.team && state.team.length === 1) {
                next = 3;
            }
            return { ...state, step: next };
        }
            
        default:
            return state;
    }
}

export function useBookingState(slug) {
    const [state, dispatch] = useReducer(bookingReducer, initialState);

    // Initial business data load
    useEffect(() => {
        let mounted = true;
        const init = async () => {
            try {
                const res = await api.getPublicBusinessInfo(slug);
                if (!mounted) return;
                
                if (!res || !res.success || !res.data) {
                    throw new Error(res?.error || res?.message || 'Neispravan odgovor poslužitelja');
                }
                
                if (res.data.booking_disabled) {
                    dispatch({ 
                        type: ACTIONS.INIT_SUCCESS, 
                        payload: { booking_disabled: true, business: { name: res.data.business_name } } 
                    });
                } else {
                    dispatch({ 
                        type: ACTIONS.INIT_SUCCESS, 
                        payload: res.data 
                    });
                }
            } catch (error) {
                if (mounted) {
                    const msg = error.message || 'Neispravan link ili greška prilikom učitavanja.';
                    dispatch({ type: ACTIONS.INIT_ERROR, payload: msg });
                }
            }
        };
        if (slug) init();
        return () => { mounted = false; };
    }, [slug]);

    // Side effect: fetch slots when selectedDate + selectedService changes
    useEffect(() => {
        let mounted = true;
        
        const fetchSlots = async () => {
            if (!state.selectedDate || !state.selectedService) return;
            
            dispatch({ type: ACTIONS.SLOTS_LOADING });
            try {
                const res = await api.getPublicAvailability(slug, state.selectedDate, state.selectedService.id);
                if (mounted) {
                    let fetchedSlots = res.data?.slots || [];
                    // Filter slots based on selectedStaff if any is selected computationally
                    if (state.selectedStaff && state.selectedStaff.id !== 'any') {
                        fetchedSlots = fetchedSlots.filter(s => s.worker_id === state.selectedStaff.id);
                    }
                    dispatch({ type: ACTIONS.SLOTS_LOADED, payload: fetchedSlots });
                }
            } catch (error) {
                console.error("Failed to fetch slots", error);
                if (mounted) {
                    dispatch({ type: ACTIONS.SLOTS_LOADED, payload: [] });
                }
            }
        };

        fetchSlots();
        return () => { mounted = false; };
    }, [slug, state.selectedDate, state.selectedService, state.selectedStaff]);

    // Side effect: Submit booking 
    useEffect(() => {
        let mounted = true;
        const submitBooking = async () => {
            if (!state.submitting || state.step === 6) return;

            try {
                const payload = {
                    service_id: state.selectedService.id,
                    worker_id: (state.selectedStaff && state.selectedStaff.id !== 'any') ? state.selectedStaff.id : (state.selectedSlot ? state.selectedSlot.worker_id : null),
                    appointment_datetime: `${state.selectedDate} ${state.selectedSlot.time}`,
                    client_name: `${state.contactParams.firstName} ${state.contactParams.lastName}`.trim(),
                    client_phone: state.contactParams.phone,
                    client_email: state.contactParams.email || null,
                    notes: state.contactParams.notes || null,
                    sms_marketing_consent: Boolean(state.contactParams.smsConsent)
                };

                const res = await api.createPublicBooking(slug, payload);
                if (mounted) {
                    dispatch({ type: ACTIONS.SUBMIT_SUCCESS, payload: res.data?.appointment });
                }
            } catch (error) {
                if (mounted) {
                    const msg = error.message || 'Greška prilikom rezervacije. Pokušajte ponovno.';
                    dispatch({ type: ACTIONS.SUBMIT_ERROR, payload: msg });
                }
            }
        };

        submitBooking();
        return () => { mounted = false; };
    }, [state.submitting, slug, state.selectedService, state.selectedStaff, state.selectedDate, state.selectedSlot, state.contactParams, state.step]);


    const actions = {
        setService: (s) => dispatch({ type: ACTIONS.SELECT_SERVICE, payload: s }),
        setStaff: (s) => dispatch({ type: ACTIONS.SELECT_STAFF, payload: s }),
        setDate: (d) => dispatch({ type: ACTIONS.SELECT_DATE, payload: d }),
        setSlot: (s) => dispatch({ type: ACTIONS.SELECT_SLOT, payload: s }),
        onScrollChange: (o) => dispatch({ type: ACTIONS.SET_SCROLL_OFFSET, payload: o }),
        updateContact: (p) => dispatch({ type: ACTIONS.UPDATE_CONTACT, payload: p }),
        goToStep: (n) => dispatch({ type: ACTIONS.GO_TO_STEP, payload: n }),
        nextStep: () => dispatch({ type: ACTIONS.NEXT_STEP }),
        submit: () => dispatch({ type: ACTIONS.SUBMIT_START }),
        clearError: () => dispatch({ type: ACTIONS.CLEAR_ERROR })
    };

    return { state, actions };
}
