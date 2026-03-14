import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../api/client';

function AutomationsSettings() {
    const { user } = useAuth();
    const [settings, setSettings] = useState({
        smsEnabled: false,
        sendConfirmation: true,
        sendReminder: true,
        sendCancellation: true,
        reminderHoursBefore: 24,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        senderName: ''
    });

    const [saved, setSaved] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user?.activeBusinessId) {
            setIsLoading(true);
            api.getBusinessById(user.activeBusinessId)
                .then(res => {
                    const data = res.data;
                    setSettings(prev => ({
                        ...prev,
                        smsEnabled: !!data.sms_enabled,
                        sendConfirmation: !!data.send_confirmation,
                        sendReminder: !!data.send_reminder,
                        sendCancellation: !!data.send_cancellation,
                    }));
                })
                .catch(err => {
                    toast.error('Greška pri učitavanju postavki');
                    console.error(err);
                })
                .finally(() => setIsLoading(false));
        }
    }, [user?.activeBusinessId]);

    const update = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    const handleSave = async () => {
        if (!user?.activeBusinessId) return;
        
        try {
            await api.updateBusiness(user.activeBusinessId, {
                sms_enabled: settings.smsEnabled,
                send_confirmation: settings.sendConfirmation,
                send_reminder: settings.sendReminder,
                send_cancellation: settings.sendCancellation
            });
            toast.success('Postavke spremljene!');
            setSaved(true);
        } catch (error) {
            toast.error('Nije uspjelo spremanje postavki');
            console.error(error);
        }
    };

    const dimmed = !settings.smsEnabled;

    return (
        <div style={{ padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
            {/* Page Header */}
            <div style={{ marginBottom: '30px' }}>
                <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', color: '#1a1a2e', fontWeight: '700' }}>
                    ⚙️ Automatizacije i postavke
                </h1>
                <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
                    Upravljajte automatskim SMS obavijestima za vaše klijente.
                </p>
            </div>

            {/* Master Toggle */}
            <div style={{
                background: settings.smsEnabled
                    ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                    : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                borderRadius: '14px', padding: '24px',
                border: settings.smsEnabled ? '2px solid #86efac' : '2px solid #dee2e6',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '24px', transition: 'all 0.3s ease'
            }}>
                <div>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#1a1a2e' }}>
                        SMS Obavijesti
                    </h2>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6c757d' }}>
                        {settings.smsEnabled ? 'Sustav je aktivan. SMS obavijesti se šalju automatski.' : 'Aktivirajte da biste omogućili automatske SMS obavijesti.'}
                    </p>
                </div>
                <ToggleSwitch
                    checked={settings.smsEnabled}
                    onChange={(val) => update('smsEnabled', val)}
                    size="large"
                />
            </div>

            {/* Dependent sections - dimmed when master is off */}
            <div style={{
                opacity: dimmed ? 0.4 : 1,
                pointerEvents: dimmed ? 'none' : 'auto',
                transition: 'opacity 0.3s ease'
            }}>
                {/* Notification Rules */}
                <div style={sectionCardStyle}>
                    <h3 style={sectionTitleStyle}>📋 Pravila obavijesti</h3>
                    <p style={sectionSubStyle}>Odaberite koje automatske poruke želite slati.</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        <ToggleRow
                            label="Potvrda termina"
                            description="Pošalji SMS klijentu kada se termin zakaže"
                            checked={settings.sendConfirmation}
                            onChange={(val) => update('sendConfirmation', val)}
                        />
                        <ToggleRow
                            label="Podsjetnik (24h)"
                            description="Pošalji podsjetnik 24 sata prije termina"
                            checked={settings.sendReminder}
                            onChange={(val) => update('sendReminder', val)}
                        />
                        <ToggleRow
                            label="Otkazivanje"
                            description="Obavijesti klijenta kada se termin otkaže"
                            checked={settings.sendCancellation}
                            onChange={(val) => update('sendCancellation', val)}
                            isLast
                        />
                    </div>
                </div>

                {/* Quiet Hours */}
                <div style={sectionCardStyle}>
                    <h3 style={sectionTitleStyle}>🌙 Tihi sati</h3>
                    <p style={sectionSubStyle}>SMS obavijesti neće biti poslane unutar tihih sati.</p>

                    <div style={{ display: 'flex', gap: '20px', marginTop: '16px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <label style={inputLabelStyle}>Od</label>
                            <input
                                type="time"
                                value={settings.quietHoursStart}
                                onChange={e => update('quietHoursStart', e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ paddingTop: '24px', fontSize: '18px', color: '#aaa' }}>→</div>
                        <div style={{ flex: 1 }}>
                            <label style={inputLabelStyle}>Do</label>
                            <input
                                type="time"
                                value={settings.quietHoursEnd}
                                onChange={e => update('quietHoursEnd', e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                    </div>
                    <div style={{
                        marginTop: '14px', padding: '10px 14px',
                        background: '#f0f4ff', borderRadius: '8px',
                        fontSize: '13px', color: '#4a6fa5', lineHeight: '1.5'
                    }}>
                        💡 Primjer: Ako klijent zakaže termin za 8:00 ujutro, a podsjetnik bi trebao ići u 8:00 
                        prethodnog dana, ali ste postavili tihe sate od {settings.quietHoursStart} do {settings.quietHoursEnd} — 
                        SMS će biti poslan u {settings.quietHoursEnd}.
                    </div>
                </div>

                {/* Sender Name */}
                <div style={sectionCardStyle}>
                    <h3 style={sectionTitleStyle}>📱 Ime pošiljatelja</h3>
                    <p style={sectionSubStyle}>Prilagodite kako se vaš biznis prikazuje u SMS porukama.</p>

                    <div style={{ marginTop: '16px' }}>
                        <label style={inputLabelStyle}>Alfanumerički ID (max 11 znakova)</label>
                        <input
                            type="text"
                            maxLength={11}
                            value={settings.senderName}
                            onChange={e => update('senderName', e.target.value.replace(/[^a-zA-Z0-9 ]/g, ''))}
                            placeholder="npr. SalonLucija"
                            style={{ ...inputStyle, maxWidth: '280px' }}
                        />
                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#888' }}>
                            {settings.senderName.length}/11 znakova
                        </div>
                    </div>

                    {settings.senderName && (
                        <div style={{
                            marginTop: '14px', padding: '12px 16px',
                            background: '#1a1a2e', borderRadius: '10px', color: 'white',
                            fontSize: '13px', display: 'inline-block'
                        }}>
                            <span style={{ color: '#888', fontSize: '11px' }}>POŠILJATELJ</span>
                            <div style={{ fontWeight: '700', fontSize: '16px', marginTop: '2px' }}>
                                {settings.senderName.toUpperCase()}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                    onClick={handleSave}
                    disabled={saved}
                    style={{
                        padding: '12px 32px',
                        background: saved ? '#e9ecef' : 'linear-gradient(135deg, #0d6efd, #6366f1)',
                        color: saved ? '#999' : 'white',
                        border: 'none', borderRadius: '8px',
                        fontWeight: '600', fontSize: '15px',
                        cursor: saved ? 'default' : 'pointer',
                        boxShadow: saved ? 'none' : '0 4px 12px rgba(13,110,253,0.3)',
                        transition: 'all 0.2s ease'
                    }}
                >
                    {saved ? '✓ Spremljeno' : 'Spremi postavke'}
                </button>
            </div>
        </div>
    );
}

// ─── Toggle Switch Component ────────────────────────────────

function ToggleSwitch({ checked, onChange, size = 'normal' }) {
    const w = size === 'large' ? 56 : 44;
    const h = size === 'large' ? 30 : 24;
    const dot = size === 'large' ? 22 : 18;

    return (
        <div
            onClick={() => onChange(!checked)}
            style={{
                width: `${w}px`, height: `${h}px`,
                borderRadius: `${h}px`,
                background: checked ? '#198754' : '#ced4da',
                position: 'relative', cursor: 'pointer',
                transition: 'background 0.25s ease',
                flexShrink: 0
            }}
        >
            <div style={{
                width: `${dot}px`, height: `${dot}px`,
                borderRadius: '50%', background: 'white',
                position: 'absolute',
                top: `${(h - dot) / 2}px`,
                left: checked ? `${w - dot - (h - dot) / 2}px` : `${(h - dot) / 2}px`,
                transition: 'left 0.25s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }} />
        </div>
    );
}

// ─── Toggle Row Component ───────────────────────────────────

function ToggleRow({ label, description, checked, onChange, isLast = false }) {
    return (
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 0',
            borderBottom: isLast ? 'none' : '1px solid #f0f0f0'
        }}>
            <div>
                <div style={{ fontWeight: '600', fontSize: '15px', color: '#1a1a2e' }}>{label}</div>
                <div style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>{description}</div>
            </div>
            <ToggleSwitch checked={checked} onChange={onChange} />
        </div>
    );
}

// ─── Shared Styles ──────────────────────────────────────────

const sectionCardStyle = {
    background: 'white', borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    padding: '24px', marginBottom: '20px'
};

const sectionTitleStyle = {
    margin: '0 0 4px 0', fontSize: '17px', color: '#1a1a2e', fontWeight: '600'
};

const sectionSubStyle = {
    margin: '0 0 0 0', fontSize: '13px', color: '#888'
};

const inputLabelStyle = {
    display: 'block', marginBottom: '6px',
    fontWeight: '500', fontSize: '13px', color: '#555'
};

const inputStyle = {
    width: '100%', padding: '10px 12px',
    borderRadius: '8px', border: '1px solid #ddd',
    fontSize: '15px', boxSizing: 'border-box',
    outline: 'none'
};

export default AutomationsSettings;
