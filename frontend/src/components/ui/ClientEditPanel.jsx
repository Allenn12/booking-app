import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import { toast } from 'sonner';
import './ClientEditPanel.css';

export default function ClientEditPanel({ client, businessId, onClose, onSaved }) {
    const [form, setForm] = useState({
        name:  client.name  || '',
        phone: client.phone || '',
        email: client.email || '',
        notes: client.notes || '',
    });
    const [errors, setErrors] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const panelRef = useRef(null);

    // Close on Escape key
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    // Focus the first input on mount
    useEffect(() => {
        const first = panelRef.current?.querySelector('input');
        if (first) first.focus();
    }, []);

    const validate = () => {
        const errs = {};
        if (!form.name.trim() || form.name.trim().length < 2) {
            errs.name = 'Ime mora imati najmanje 2 znaka';
        }
        const phone = form.phone.trim();
        if (!phone) {
            errs.phone = 'Broj telefona je obavezan';
        } else if (!/^[+]?[0-9\s\-().]{6,20}$/.test(phone)) {
            errs.phone = 'Neispravan format broja telefona';
        }
        if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
            errs.email = 'Neispravan format email adrese';
        }
        return errs;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        // Clear field error on type
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }
        setIsSaving(true);
        try {
            const res = await api.updateClient(businessId, client.id, {
                name:  form.name.trim(),
                phone: form.phone.trim(),
                email: form.email.trim() || null,
                notes: form.notes || null,
            });
            if (res.success) {
                toast.success('Podaci klijenta su ažurirani');
                onSaved(res.data);
            }
        } catch (err) {
            toast.error(err.message || 'Greška pri ažuriranju klijenta');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div className="cep-backdrop" onClick={onClose} aria-hidden="true" />

            {/* Panel */}
            <aside className="cep-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Uredi klijenta">
                <div className="cep-header">
                    <h2 className="cep-title">Uredi klijenta</h2>
                    <button className="cep-close-btn" onClick={onClose} title="Zatvori" aria-label="Zatvori panel">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <form className="cep-body" onSubmit={handleSubmit} noValidate>
                    {/* Name */}
                    <div className="cep-field">
                        <label className="cep-label" htmlFor="cep-name">
                            Ime i prezime <span className="cep-required">*</span>
                        </label>
                        <input
                            id="cep-name"
                            name="name"
                            type="text"
                            className={`cep-input${errors.name ? ' cep-input--error' : ''}`}
                            value={form.name}
                            onChange={handleChange}
                            placeholder="Ana Horvat"
                            autoComplete="name"
                        />
                        {errors.name && <span className="cep-error-msg">{errors.name}</span>}
                    </div>

                    {/* Phone */}
                    <div className="cep-field">
                        <label className="cep-label" htmlFor="cep-phone">
                            Broj telefona <span className="cep-required">*</span>
                        </label>
                        <input
                            id="cep-phone"
                            name="phone"
                            type="tel"
                            className={`cep-input${errors.phone ? ' cep-input--error' : ''}`}
                            value={form.phone}
                            onChange={handleChange}
                            placeholder="+385 91 234 5678"
                            autoComplete="tel"
                        />
                        {errors.phone && <span className="cep-error-msg">{errors.phone}</span>}
                    </div>

                    {/* Email */}
                    <div className="cep-field">
                        <label className="cep-label" htmlFor="cep-email">
                            Email adresa <span className="cep-optional">(opcionalno)</span>
                        </label>
                        <input
                            id="cep-email"
                            name="email"
                            type="email"
                            className={`cep-input${errors.email ? ' cep-input--error' : ''}`}
                            value={form.email}
                            onChange={handleChange}
                            placeholder="ana@example.com"
                            autoComplete="email"
                        />
                        {errors.email && <span className="cep-error-msg">{errors.email}</span>}
                    </div>

                    {/* Notes */}
                    <div className="cep-field cep-field--grow">
                        <label className="cep-label" htmlFor="cep-notes">
                            Interne bilješke <span className="cep-optional">(vidljivo samo osoblju)</span>
                        </label>
                        <textarea
                            id="cep-notes"
                            name="notes"
                            className="cep-input cep-textarea"
                            value={form.notes}
                            onChange={handleChange}
                            placeholder="Alergije, preferencije, posebni zahtjevi..."
                            rows={5}
                        />
                    </div>

                    <div className="cep-footer">
                        <button type="button" className="cep-btn-cancel" onClick={onClose} disabled={isSaving}>
                            Odustani
                        </button>
                        <button type="submit" className="cep-btn-save" disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <span className="cep-spinner" />
                                    Sprema se...
                                </>
                            ) : 'Spremi izmjene'}
                        </button>
                    </div>
                </form>
            </aside>
        </>
    );
}
