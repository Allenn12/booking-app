import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../api/client';
import { toast } from 'sonner';

function Services() {
    const { user } = useAuth();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        duration_minutes: '',
        price: ''
    });

    useEffect(() => {
        if (user?.activeBusinessId) {
            fetchServices();
        }
    }, [user?.activeBusinessId]);

    const fetchServices = async () => {
        try {
            setLoading(true);
            const res = await api.getBusinessServices(user.activeBusinessId);
            if (res.success) {
                // Filter out inactive services just in case, though backend should handle
                setServices(res.data.filter(s => s.is_active));
            }
        } catch (err) {
            toast.error('Failed to load services');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (service = null) => {
        if (service) {
            setEditingService(service);
            setFormData({
                name: service.name || '',
                description: service.description || '',
                duration_minutes: service.duration_minutes || '',
                price: service.price || ''
            });
        } else {
            setEditingService(null);
            setFormData({
                name: '',
                description: '',
                duration_minutes: '',
                price: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingService(null);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            // Scrub empty strings to null for integers
            const payload = {
                ...formData,
                duration_minutes: formData.duration_minutes === '' ? null : Number(formData.duration_minutes),
                price: formData.price === '' ? null : Number(formData.price)
            };

            if (editingService) {
                const res = await api.updateService(user.activeBusinessId, editingService.id, payload);
                if (res.success) {
                    toast.success('Service updated successfully');
                    setServices(prev => prev.map(s => s.id === editingService.id ? res.data : s));
                    handleCloseModal();
                }
            } else {
                const res = await api.createService(user.activeBusinessId, payload);
                if (res.success) {
                    toast.success('Service created successfully');
                    setServices(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
                    handleCloseModal();
                }
            }
        } catch (err) {
            toast.error(err.message || 'Failed to save service');
        }
    };

    const handleDelete = async (serviceId) => {
        if (!window.confirm("Are you sure you want to delete this service? This action will hide it from new appointments.")) {
            return;
        }

        try {
            const res = await api.deleteService(user.activeBusinessId, serviceId);
            if (res.success) {
                toast.success('Service deleted successfully');
                setServices(prev => prev.filter(s => s.id !== serviceId));
            }
        } catch (err) {
            toast.error(err.message || 'Failed to delete service');
        }
    };

    const generateStandardService = () => {
        setEditingService(null);
        setFormData({
            name: 'Standard Service',
            description: 'Our standard 30-minute booking.',
            duration_minutes: '30',
            price: ''
        });
        setIsModalOpen(true);
    };

    if (loading) return <div>Loading services...</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 style={{ margin: 0, color: '#333' }}>Services</h1>
                <button
                    onClick={() => handleOpenModal()}
                    style={{
                        padding: '10px 20px',
                        background: '#0d6efd',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <span style={{ fontSize: '18px' }}>+</span> Add New Service
                </button>
            </div>

            {services.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '15px' }}>✂️</div>
                    <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>No Services Yet</h2>
                    <p style={{ color: '#666', marginBottom: '25px', maxWidth: '400px', margin: '0 auto 25px auto' }}>
                        You need at least one service before customers can book appointments with your business.
                    </p>
                    <button
                        onClick={generateStandardService}
                        style={{
                            padding: '12px 24px',
                            background: '#f8f9fa',
                            color: '#0d6efd',
                            border: '2px solid #0d6efd',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '16px'
                        }}
                    >
                        Create "Standard Service"
                    </button>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '20px'
                }}>
                    {services.map(service => (
                        <div key={service.id} style={{
                            background: 'white',
                            padding: '24px',
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                    <h3 style={{ margin: 0, fontSize: '18px', color: '#2b2b2b' }}>{service.name}</h3>
                                    {service.price && (
                                        <div style={{ fontWeight: 'bold', color: '#198754', background: '#d1e7dd', padding: '4px 8px', borderRadius: '4px', fontSize: '14px' }}>
                                            €{service.price}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#666', fontSize: '14px', marginBottom: '15px' }}>
                                    <span>⏱️</span>
                                    <span>{service.duration_minutes} min</span>
                                </div>

                                {service.description && (
                                    <p style={{ color: '#555', fontSize: '14px', lineHeight: '1.5', margin: '0 0 20px 0' }}>
                                        {service.description}
                                    </p>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #f0f0f0' }}>
                                <button
                                    onClick={() => handleOpenModal(service)}
                                    style={{ flex: 1, padding: '8px', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', cursor: 'pointer', color: '#495057', fontWeight: '500' }}
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(service.id)}
                                    style={{ flex: 1, padding: '8px', background: '#fff5f5', border: '1px solid #ffc9c9', borderRadius: '4px', cursor: 'pointer', color: '#e03131', fontWeight: '500' }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                }}>
                    <div style={{
                        background: 'white', borderRadius: '12px', width: '100%', maxWidth: '500px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)', overflow: 'hidden'
                    }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>{editingService ? 'Edit Service' : 'Add New Service'}</h3>
                            <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999' }}>&times;</button>
                        </div>

                        <form onSubmit={handleSave} style={{ padding: '24px' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Service Name *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    placeholder="e.g. Men's Haircut"
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                                />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Description</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    placeholder="Optional details about this service..."
                                    rows="3"
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Duration (Minutes)</label>
                                    <input
                                        type="number"
                                        name="duration_minutes"
                                        value={formData.duration_minutes}
                                        onChange={handleChange}
                                        placeholder="e.g. 30"
                                        min="5"
                                        step="5"
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                                    />
                                    <small style={{ color: '#888', display: 'block', marginTop: '4px', fontSize: '12px' }}>Leave empty for default 30 min</small>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Price (€)</label>
                                    <input
                                        type="number"
                                        name="price"
                                        value={formData.price}
                                        onChange={handleChange}
                                        placeholder="e.g. 25.00"
                                        min="0"
                                        step="0.01"
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button type="button" onClick={handleCloseModal} style={{ padding: '10px 16px', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
                                    Cancel
                                </button>
                                <button type="submit" style={{ padding: '10px 24px', background: '#0d6efd', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
                                    {editingService ? 'Save Changes' : 'Create Service'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Services;
