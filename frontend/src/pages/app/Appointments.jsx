import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';
import { toast } from 'sonner';

function Appointments() {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [showModal, setShowModal] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState(null);

    // Basic form state
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        appointment_datetime: '',
        notes: '',
        status: 'scheduled'
    });

    useEffect(() => {
        fetchAppointments();
    }, [date]);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingAppointment) {
                await api.updateAppointment(editingAppointment.id, formData);
                toast.success('Appointment updated');
            } else {
                const res = await api.createAppointment(formData);
                toast.success('Appointment created');
                if (res.data.messaging_enabled) {
                    toast.info('Messaging is enabled for this business');
                }
            }
            setShowModal(false);
            setEditingAppointment(null);
            fetchAppointments();
        } catch (err) {
            toast.error('Failed to save appointment');
        }
    };

    const openEdit = (appt) => {
        setEditingAppointment(appt);
        setFormData({
            name: appt.name || '',
            phone: appt.phone || '',
            appointment_datetime: appt.appointment_datetime.split('.')[0], // strip ms/Z
            notes: appt.notes || '',
            status: appt.status
        });
        setShowModal(true);
    };

    const openCreate = () => {
        setEditingAppointment(null);
        setFormData({
            name: '',
            phone: '',
            appointment_datetime: `${date}T10:00`,
            notes: '',
            status: 'scheduled'
        });
        setShowModal(true);
    };

    const canDelete = (appt) => {
        if (['owner', 'admin'].includes(user?.role)) return true;
        return appt.user_id === user?.id || appt.assigned_to_user_id === user?.id;
    };

    return (
        <div style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Appointments</h1>
                <button onClick={openCreate} style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    + New Appointment
                </button>
            </div>

            <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                <label>Filter by Date: </label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ddd' }} />
            </div>

            {loading ? (
                <p>Loading...</p>
            ) : appointments.length === 0 ? (
                <p>No appointments for this day.</p>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', background: 'white' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                            <th style={{ padding: '12px' }}>Time</th>
                            <th style={{ padding: '12px' }}>Client</th>
                            <th style={{ padding: '12px' }}>Phone</th>
                            <th style={{ padding: '12px' }}>Status</th>
                            <th style={{ padding: '12px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {appointments.map(appt => (
                            <tr key={appt.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '12px' }}>{new Date(appt.appointment_datetime).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}</td>
                                <td style={{ padding: '12px' }}>{appt.name}</td>
                                <td style={{ padding: '12px' }}>{appt.phone}</td>
                                <td style={{ padding: '12px' }}>
                                    <select
                                        value={appt.status}
                                        onChange={e => handleStatusChange(appt.id, e.target.value)}
                                        style={{ padding: '4px', borderRadius: '4px' }}
                                    >
                                        <option value="scheduled">Scheduled</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                        <option value="no_show">No Show</option>
                                    </select>
                                </td>
                                <td style={{ padding: '12px', display: 'flex', gap: '10px' }}>
                                    <button onClick={() => openEdit(appt)} style={{ padding: '5px 10px', background: '#ffc107', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Edit</button>
                                    {canDelete(appt) && (
                                        <button onClick={() => handleDelete(appt.id)} style={{ padding: '5px 10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Delete</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '8px', width: '400px' }}>
                        <h2>{editingAppointment ? 'Edit Appointment' : 'New Appointment'}</h2>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <label>Client Name
                                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
                            </label>
                            <label>Phone
                                <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
                            </label>
                            <label>Date & Time
                                <input type="datetime-local" required value={formData.appointment_datetime} onChange={e => setFormData({ ...formData, appointment_datetime: e.target.value })} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
                            </label>
                            <label>Notes
                                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
                            </label>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button type="submit" style={{ flex: 1, padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
                                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Appointments;
