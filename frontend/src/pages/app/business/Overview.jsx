import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../api/client';
import { toast } from 'sonner';

function Overview() {
    const { user } = useAuth();
    const [business, setBusiness] = useState(null);
    const [initialBusiness, setInitialBusiness] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const defaultHours = [
        { day_of_week: 1, open_time: '09:00', close_time: '17:00', is_closed: 0 }, // Monday
        { day_of_week: 2, open_time: '09:00', close_time: '17:00', is_closed: 0 }, // Tuesday
        { day_of_week: 3, open_time: '09:00', close_time: '17:00', is_closed: 0 }, // Wednesday
        { day_of_week: 4, open_time: '09:00', close_time: '17:00', is_closed: 0 }, // Thursday
        { day_of_week: 5, open_time: '09:00', close_time: '17:00', is_closed: 0 }, // Friday
        { day_of_week: 6, open_time: '09:00', close_time: '17:00', is_closed: 1 }, // Saturday
        { day_of_week: 7, open_time: '09:00', close_time: '17:00', is_closed: 1 }, // Sunday
    ];

    useEffect(() => {
        if (user?.activeBusinessId) {
            fetchBusinessData();
        }
    }, [user?.activeBusinessId]);

    const fetchBusinessData = async () => {
        try {
            setLoading(true);
            const res = await api.getBusinessById(user.activeBusinessId);
            if (res.success) {
                // Ensure time string is just HH:mm (not HH:mm:ss if returned from MySQL)
                const formatTime = (timeStr) => {
                    if (!timeStr) return '';
                    return timeStr.substring(0, 5);
                };

                let fetchedHours = res.data.business_hours;
                if (!fetchedHours || fetchedHours.length === 0) {
                    fetchedHours = defaultHours;
                } else {
                    fetchedHours = fetchedHours.map(h => ({
                        ...h,
                        day_of_week: h.day_of_week === 0 ? 7 : h.day_of_week,
                        open_time: formatTime(h.open_time),
                        close_time: formatTime(h.close_time)
                    })).sort((a, b) => a.day_of_week - b.day_of_week);
                }

                const businessData = {
                    name: res.data.name || '',
                    phone: res.data.phone || '',
                    email: res.data.email || '',
                    address: res.data.address || '',
                    city: res.data.city || '',
                    post_code: res.data.post_code || '',
                    business_hours: fetchedHours
                };
                setBusiness(businessData);
                setInitialBusiness(businessData);
            }
        } catch (err) {
            toast.error('Failed to load business details');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setBusiness(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleHourChange = (dayOfWeek, field, value) => {
        setBusiness(prev => {
            const updatedHours = prev.business_hours.map(hour => {
                if (hour.day_of_week === dayOfWeek) {
                    return { ...hour, [field]: value };
                }
                return hour;
            });
            return {
                ...prev,
                business_hours: updatedHours
            };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            await api.updateBusiness(user.activeBusinessId, business);
            setInitialBusiness(business);
            toast.success('Business details updated successfully');
        } catch (err) {
            toast.error(err.message || 'Failed to update business details');
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = JSON.stringify(business) !== JSON.stringify(initialBusiness);

    if (loading) return <div>Loading business details...</div>;
    if (!business) return <div>No business data available</div>;

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Business Overview</h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '14px', color: '#555' }}>Business Name *</label>
                    <input
                        type="text"
                        name="name"
                        value={business.name}
                        onChange={handleChange}
                        required
                        style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '14px', color: '#555' }}>Email</label>
                    <input
                        type="email"
                        name="email"
                        value={business.email}
                        onChange={handleChange}
                        style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '14px', color: '#555' }}>Phone</label>
                    <input
                        type="text"
                        name="phone"
                        value={business.phone}
                        onChange={handleChange}
                        style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '14px', color: '#555' }}>Address</label>
                    <input
                        type="text"
                        name="address"
                        value={business.address}
                        onChange={handleChange}
                        style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 2 }}>
                        <label style={{ fontWeight: 'bold', fontSize: '14px', color: '#555' }}>City</label>
                        <input
                            type="text"
                            name="city"
                            value={business.city}
                            onChange={handleChange}
                            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                        <label style={{ fontWeight: 'bold', fontSize: '14px', color: '#555' }}>Post Code</label>
                        <input
                            type="text"
                            name="post_code"
                            value={business.post_code}
                            onChange={handleChange}
                            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                    </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e9ecef', margin: '15px 0' }} />

                <div>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>Working Hours</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {business.business_hours.map((hour) => {
                            const dayNames = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday' };
                            const dayName = dayNames[hour.day_of_week];

                            return (
                                <div key={hour.day_of_week} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '4px', border: '1px solid #e9ecef' }}>

                                    <div style={{ width: '100px', fontWeight: 'bold', color: '#555' }}>
                                        {dayName}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', width: '100px' }}>
                                        <input
                                            type="checkbox"
                                            checked={hour.is_closed === 1}
                                            onChange={(e) => handleHourChange(hour.day_of_week, 'is_closed', e.target.checked ? 1 : 0)}
                                            style={{ cursor: 'pointer' }}
                                            id={`closed-${hour.day_of_week}`}
                                        />
                                        <label htmlFor={`closed-${hour.day_of_week}`} style={{ fontSize: '14px', color: '#666', cursor: 'pointer' }}>Closed</label>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: hour.is_closed ? 0.5 : 1 }}>
                                        <input
                                            type="time"
                                            lang="en-GB"
                                            value={hour.open_time || ''}
                                            onChange={(e) => handleHourChange(hour.day_of_week, 'open_time', e.target.value)}
                                            disabled={hour.is_closed === 1}
                                            style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                                        />
                                        <span style={{ color: '#666' }}>to</span>
                                        <input
                                            type="time"
                                            lang="en-GB"
                                            value={hour.close_time || ''}
                                            onChange={(e) => handleHourChange(hour.day_of_week, 'close_time', e.target.value)}
                                            disabled={hour.is_closed === 1}
                                            style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={saving || !hasChanges}
                    style={{
                        marginTop: '10px',
                        padding: '12px',
                        background: (saving || !hasChanges) ? '#6c757d' : '#0d6efd',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (saving || !hasChanges) ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </form>
        </div>
    );
}

export default Overview;
