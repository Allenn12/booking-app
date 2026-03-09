import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';
import { toast } from 'sonner';

function Appointments() {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState([]);
    const [services, setServices] = useState([]);
    const [team, setTeam] = useState([]);
    const [loading, setLoading] = useState(true);

    // Map initial date to local
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [showModal, setShowModal] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        clientName: '',
        clientPhone: '',
        appointment_datetime: '',
        service_id: '',
        assigned_to_user_id: '',
        notes: ''
    });

    useEffect(() => {
        if (user?.activeBusinessId) {
            fetchInitialData();
            fetchAppointments();
        }
    }, [user?.activeBusinessId, date]);

    const fetchInitialData = async () => {
        try {
            const [servicesRes, teamRes] = await Promise.all([
                api.getBusinessServices(user.activeBusinessId),
                api.getBusinessTeam(user.activeBusinessId)
            ]);

            if (servicesRes.success) setServices(servicesRes.data.filter(s => s.is_active));
            if (teamRes.success) setTeam(teamRes.data);
        } catch (err) {
            toast.error('Failed to load initial configuration data');
        }
    };

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const res = await api.getAppointments(date);
            if (res.success) {
                setAppointments(res.data);
            }
        } catch (err) {
            toast.error('Failed to load appointments');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            const res = await api.updateAppointment(id, { status: newStatus });
            if (res.success) {
                toast.success('Status updated');
                setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
            }
        } catch (err) {
            toast.error('Failed to update status');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this appointment?')) return;
        try {
            const res = await api.deleteAppointment(id);
            if (res.success) {
                toast.success('Appointment deleted');
                setAppointments(prev => prev.filter(a => a.id !== id));
            }
        } catch (err) {
            toast.error(err.message || 'Failed to delete');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingAppointment) {
                // Update implementation can be expanded later
                toast.error('Edit not currently configured for complex appointments');
            } else {
                const payload = {
                    ...formData,
                    service_id: Number(formData.service_id),
                    assigned_to_user_id: Number(formData.assigned_to_user_id)
                };

                const res = await api.createAppointment(payload);
                if (res.success) {
                    toast.success('Appointment successfully created');
                    if (res.data?.messaging_enabled) toast.info('Client notified via SMS');
                }
            }
            setShowModal(false);
            setEditingAppointment(null);
            fetchAppointments();
        } catch (err) {
            // Displays exact 400 Bad Request error from Backend (Overlaps, Hours, Phone)
            toast.error(err.message || 'Failed to save appointment. Verify details.');
        }
    };

    const openCreate = () => {
        if (services.length === 0 || team.length === 0) {
            toast.error('You must define at least one Service and one Team Member before booking.');
            return;
        }

        setEditingAppointment(null);
        setFormData({
            clientName: '',
            clientPhone: '',
            appointment_datetime: `${date}T10:00`,
            service_id: services[0]?.id || '',
            assigned_to_user_id: user?.id || team[0]?.id || '',
            notes: ''
        });
        setShowModal(true);
    };

    const canDelete = (appt) => {
        if (['owner', 'admin'].includes(user?.role)) return true;
        return appt.user_id === user?.id || appt.assigned_to_user_id === user?.id;
    };

    const getServiceName = (id) => services.find(s => s.id === id)?.name || `Service #${id}`;
    const getWorkerName = (id) => team.find(w => w.id === id)?.name || `Worker #${id}`;

    return (
        <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ color: '#2b2b2b' }}>Appointments</h1>
                <button
                    onClick={openCreate}
                    style={{
                        padding: '10px 20px', background: '#0d6efd', color: 'white',
                        border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                    }}
                >
                    + New Appointment
                </button>
            </div>

            <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Filter Date: </label>
                <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                />
            </div>

            {loading ? (
                <p>Loading schedule...</p>
            ) : appointments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '15px' }}>📅</div>
                    <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>No Appointments</h2>
                    <p style={{ color: '#666' }}>Your schedule is clear for this day.</p>
                </div>
            ) : (
                <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                            <tr>
                                <th style={{ padding: '16px' }}>Time</th>
                                <th style={{ padding: '16px' }}>Client</th>
                                <th style={{ padding: '16px' }}>Details</th>
                                <th style={{ padding: '16px' }}>Status</th>
                                <th style={{ padding: '16px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.map(appt => (
                                <tr key={appt.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '16px', fontWeight: '600' }}>
                                        {new Date(appt.appointment_datetime).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: '500', color: '#2b2b2b' }}>{appt.name}</div>
                                        <div style={{ fontSize: '13px', color: '#666' }}>{appt.phone}</div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: '500', color: '#0d6efd' }}>{getServiceName(appt.service_id)}</div>
                                        <div style={{ fontSize: '13px', color: '#666' }}>with {getWorkerName(appt.assigned_to_user_id)}</div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <select
                                            value={appt.status}
                                            onChange={e => handleStatusChange(appt.id, e.target.value)}
                                            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc' }}
                                        >
                                            <option value="scheduled">Scheduled</option>
                                            <option value="completed">Completed</option>
                                            <option value="cancelled">Cancelled</option>
                                            <option value="no_show">No Show</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        {canDelete(appt) && (
                                            <button
                                                onClick={() => handleDelete(appt.id)}
                                                style={{ padding: '6px 12px', background: '#fff5f5', color: '#dc3545', border: '1px solid #ffc9c9', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Appointment Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                }}>
                    <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '500px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>New Appointment</h3>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999' }}>&times;</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Client Name *</label>
                                    <input type="text" name="clientName" required value={formData.clientName} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Client Phone *</label>
                                    <input type="tel" name="clientPhone" required value={formData.clientPhone} onChange={handleChange} placeholder="e.g. +38591234567" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Date & Time *</label>
                                <input type="datetime-local" name="appointment_datetime" required value={formData.appointment_datetime} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                            </div>

                            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Service *</label>
                                    <select name="service_id" required value={formData.service_id} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}>
                                        {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}m)</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>With Worker *</label>
                                    <select name="assigned_to_user_id" required value={formData.assigned_to_user_id} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}>
                                        {team.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Notes</label>
                                <textarea name="notes" value={formData.notes} onChange={handleChange} rows="2" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', resize: 'vertical' }} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 16px', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Cancel</button>
                                <button type="submit" style={{ padding: '10px 24px', background: '#0d6efd', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Book Appointment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Appointments;
