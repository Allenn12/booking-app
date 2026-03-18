import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/client';
import { useDebounce } from '../../hooks/useDebounce';
import './ClientSelector.css';

/**
 * ClientSelector — Reusable client picker for appointments.
 *
 * Selection model (passed via onChange):
 *   { mode: 'none' }
 *   { mode: 'existing', clientId, name, phone }
 *   { mode: 'new', name, phone, email }
 *   { mode: 'walk_in' }
 *
 * Props:
 *   businessId  — required, current business context
 *   value       — current selection object
 *   onChange     — (selection) => void
 *   disabled    — optional, locks the input
 *   error       — optional, validation error string to display
 */
export default function ClientSelector({ businessId, value, onChange, disabled = false, error = '' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  // Inline "New Client" form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newErrors, setNewErrors] = useState({});

  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const mode = value?.mode || 'none';

  // ─── Search on debounced query change ───
  useEffect(() => {
    if (!debouncedQuery.trim() || !businessId) {
      setResults([]);
      return;
    }

    let cancelled = false;

    const fetchResults = async () => {
      setIsLoading(true);
      setSearchError('');
      try {
        const res = await api.searchClients(businessId, debouncedQuery.trim());
        if (!cancelled && res.success) {
          setResults(res.data);
        }
      } catch (err) {
        console.error('Search error:', err);
        if (!cancelled) {
          setSearchError('Greška pri pretraživanju');
          setResults([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchResults();
    return () => { cancelled = true; };
  }, [debouncedQuery, businessId]);

  // ─── Close dropdown on outside click ───
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setShowNewForm(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Handlers ───
  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    setShowNewForm(false);
  }, []);

  const handleInputFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  const selectExisting = useCallback((client) => {
    onChange({ mode: 'existing', clientId: client.id, name: client.name, phone: client.phone });
    setQuery('');
    setIsOpen(false);
    setShowNewForm(false);
  }, [onChange]);

  const selectWalkIn = useCallback(() => {
    onChange({ mode: 'walk_in' });
    setQuery('');
    setIsOpen(false);
    setShowNewForm(false);
  }, [onChange]);

  const startNewClient = useCallback(() => {
    // Pre-fill phone if the user typed a number in the search box
    const isPhoneLike = /^[+\d]/.test(query.trim());
    setNewName(isPhoneLike ? '' : query.trim());
    setNewPhone(isPhoneLike ? query.trim() : '');
    setNewEmail('');
    setNewErrors({});
    setShowNewForm(true);
    setIsOpen(false);
  }, [query]);

  const validateNewForm = useCallback(() => {
    const errors = {};
    if (!newName.trim()) errors.name = 'Ime je obavezno';
    if (!newPhone.trim()) {
      errors.phone = 'Telefon je obavezan';
    } else {
      // Basic phone validation
      const cleaned = newPhone.replace(/[\s\-()]/g, '');
      if (cleaned.length < 8) errors.phone = 'Prekratak broj';
    }
    setNewErrors(errors);
    return Object.keys(errors).length === 0;
  }, [newName, newPhone]);

  const confirmNewClient = useCallback(() => {
    if (!validateNewForm()) return;
    onChange({
      mode: 'new',
      name: newName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim()
    });
    setShowNewForm(false);
    setQuery('');
  }, [validateNewForm, onChange, newName, newPhone, newEmail]);

  const cancelNewClient = useCallback(() => {
    setShowNewForm(false);
    setNewErrors({});
  }, []);

  const clearSelection = useCallback(() => {
    onChange({ mode: 'none' });
    setQuery('');
    setShowNewForm(false);
    // Focus the input after clearing
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [onChange]);

  // ─── Render: Selected chip ───
  if (mode !== 'none' && !showNewForm) {
    return (
      <div className="cs-container" ref={containerRef}>
        <div className="cs-chip">
          <span className="cs-chip-icon">
            {mode === 'walk_in' ? '👤' : mode === 'new' ? '✨' : '✓'}
          </span>
          <div className="cs-chip-info">
            <div className="cs-chip-name">
              {mode === 'walk_in' ? 'Walk-in (bez podataka)' : value.name}
            </div>
            {value.phone && mode !== 'walk_in' && (
              <div className="cs-chip-phone">{value.phone}</div>
            )}
          </div>
          <span className={`cs-chip-badge ${mode === 'existing' ? 'existing' : mode === 'new' ? 'new-client' : 'walk-in'}`}>
            {mode === 'existing' ? 'Postojeći' : mode === 'new' ? 'Novi' : 'Walk-in'}
          </span>
          {!disabled && (
            <button
              type="button"
              className="cs-chip-clear"
              onClick={clearSelection}
              title="Promijeni klijenta"
              aria-label="Clear client selection"
            >
              ×
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Render: Inline new client form ───
  if (showNewForm) {
    return (
      <div className="cs-container" ref={containerRef}>
        <div className="cs-new-form">
          <div className="cs-new-form-fields">
            <div className="cs-new-form-row">
              <div className="cs-new-field">
                <label>Ime *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setNewErrors(prev => ({ ...prev, name: undefined })); }}
                  className={newErrors.name ? 'has-error' : ''}
                  placeholder="Ime i prezime"
                  autoFocus
                />
                {newErrors.name && <div className="cs-field-error">{newErrors.name}</div>}
              </div>
              <div className="cs-new-field">
                <label>Telefon *</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => { setNewPhone(e.target.value); setNewErrors(prev => ({ ...prev, phone: undefined })); }}
                  className={newErrors.phone ? 'has-error' : ''}
                  placeholder="+385 91 234 5678"
                />
                {newErrors.phone && <div className="cs-field-error">{newErrors.phone}</div>}
              </div>
            </div>
            <div className="cs-new-field">
              <label>Email (opcionalno)</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@primjer.hr"
              />
            </div>
          </div>
          <div className="cs-new-form-actions">
            <button type="button" className="cs-btn-cancel" onClick={cancelNewClient}>
              Odustani
            </button>
            <button type="button" className="cs-btn-confirm" onClick={confirmNewClient}>
              Potvrdi klijenta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Search input + dropdown ───
  const showDropdown = isOpen && (query.trim().length > 0 || results.length > 0);

  return (
    <div className="cs-container" ref={containerRef}>
      <div className="cs-search-wrap">
        <span className="cs-search-icon">🔍</span>
        <input
          ref={inputRef}
          type="text"
          className="cs-search-input"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder="Pretraži klijenta po imenu ili telefonu…"
          disabled={disabled}
          autoComplete="off"
          aria-label="Search clients"
          aria-expanded={showDropdown}
        />
        {isLoading && <div className="cs-spinner-icon" />}
      </div>

      {showDropdown && (
        <div className="cs-dropdown" role="listbox">
          {/* Search results */}
          {results.length > 0 && results.map((client) => (
            <button
              key={client.id}
              type="button"
              className="cs-dropdown-item"
              onClick={() => selectExisting(client)}
              role="option"
            >
              <span className="item-icon">👤</span>
              <div>
                <div className="item-name">{client.name}</div>
                <div className="item-phone">{client.phone}</div>
              </div>
            </button>
          ))}

          {/* No results message */}
          {!isLoading && query.trim().length > 0 && results.length === 0 && !searchError && (
            <div className="cs-dropdown-empty">
              Nema rezultata za „{query.trim()}"
            </div>
          )}

          {/* Search error */}
          {searchError && (
            <div className="cs-dropdown-empty" style={{ color: '#ef4444' }}>
              {searchError}
            </div>
          )}

          {/* Divider + action buttons */}
          {(results.length > 0 || query.trim().length > 0) && (
            <>
              <div className="cs-dropdown-divider" />
              <button
                type="button"
                className="cs-dropdown-item cs-action-item new-action"
                onClick={startNewClient}
              >
                <span className="item-icon">➕</span>
                <span>Novi klijent</span>
              </button>
              <button
                type="button"
                className="cs-dropdown-item cs-action-item walkin-action"
                onClick={selectWalkIn}
              >
                <span className="item-icon">🚶</span>
                <span>Walk-in (bez podataka)</span>
              </button>
            </>
          )}

          {/* Show actions even when query is empty but dropdown opened */}
          {query.trim().length === 0 && (
            <>
              <button
                type="button"
                className="cs-dropdown-item cs-action-item new-action"
                onClick={startNewClient}
              >
                <span className="item-icon">➕</span>
                <span>Novi klijent</span>
              </button>
              <button
                type="button"
                className="cs-dropdown-item cs-action-item walkin-action"
                onClick={selectWalkIn}
              >
                <span className="item-icon">🚶</span>
                <span>Walk-in (bez podataka)</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Show dropdown on focus even with empty query */}
      {isOpen && query.trim().length === 0 && !showDropdown && (
        <div className="cs-dropdown" role="listbox">
          <div className="cs-dropdown-empty">
            Počnite tipkati za pretraživanje…
          </div>
          <div className="cs-dropdown-divider" />
          <button
            type="button"
            className="cs-dropdown-item cs-action-item new-action"
            onClick={startNewClient}
          >
            <span className="item-icon">➕</span>
            <span>Novi klijent</span>
          </button>
          <button
            type="button"
            className="cs-dropdown-item cs-action-item walkin-action"
            onClick={selectWalkIn}
          >
            <span className="item-icon">🚶</span>
            <span>Walk-in (bez podataka)</span>
          </button>
        </div>
      )}

      {error && <div className="cs-validation-error">{error}</div>}
    </div>
  );
}
