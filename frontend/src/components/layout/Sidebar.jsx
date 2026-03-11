import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';
import { toast } from 'sonner';
import './Sidebar.css';

function Sidebar() {
    const { user, businesses, logout, checkSession } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // State no longer needed for business toggle (always open)

    // Check if a path is active
    const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

    const handleSwitch = async (e) => {
        const businessId = e.target.value;
        if (!businessId) return;

        if (businessId === 'ACTION_CREATE_JOIN') {
            navigate('/create-join');
            return;
        }

        try {
            const res = await api.selectBusiness(businessId);
            if (res.success) {
                toast.success('Switched business');
                await checkSession();
                navigate(res.data.redirectTo);
            }
        } catch (err) {
            toast.error('Switch failed');
        }
    };

    const isOwnerOrAdmin = ['owner', 'admin'].includes(user?.role);

    return (
        <aside className="sidebar-container">
            <div className="sidebar-header">
                <h2>BookingApp</h2>
            </div>

            <nav className="sidebar-nav">
                {isOwnerOrAdmin && (
                    <Link
                        to="/dashboard"
                        className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}
                    >
                        Dashboard
                    </Link>
                )}

                {user?.activeBusinessId && (
                    <Link
                        to="/appointments"
                        className={`nav-item ${isActive('/appointments') ? 'active' : ''}`}
                    >
                        Appointments
                    </Link>
                )}

                {isOwnerOrAdmin && (
                    <div className="nav-group">
                        <div
                            className={`nav-item nav-toggle ${location.pathname.startsWith('/business') ? 'active' : ''}`}
                            onClick={() => navigate('/business/overview')}
                            style={{ cursor: 'pointer' }}
                        >
                            Business
                            <span className="toggle-icon open">▼</span>
                        </div>

                        <div className="sub-menu">
                            <Link
                                to="/business/overview"
                                className={`sub-nav-item ${isActive('/business/overview') ? 'active' : ''}`}
                            >
                                Overview
                            </Link>
                            <Link
                                to="/business/services"
                                className={`sub-nav-item ${isActive('/business/services') ? 'active' : ''}`}
                            >
                                Services
                            </Link>
                            <Link
                                to="/business/team"
                                className={`sub-nav-item ${isActive('/business/team') ? 'active' : ''}`}
                            >
                                Team
                            </Link>
                        </div>
                    </div>
                )}

                {isOwnerOrAdmin && (
                    <div className="nav-group">
                        <div
                            className={`nav-item nav-toggle ${location.pathname.startsWith('/messaging') ? 'active' : ''}`}
                            onClick={() => navigate('/messaging/automations')}
                            style={{ cursor: 'pointer' }}
                        >
                            💬 Messaging
                            <span className="toggle-icon open">▼</span>
                        </div>

                        <div className="sub-menu">
                            <Link
                                to="/messaging/automations"
                                className={`sub-nav-item ${isActive('/messaging/automations') ? 'active' : ''}`}
                            >
                                Automatizacije
                            </Link>
                            <Link
                                to="/messaging/templates"
                                className={`sub-nav-item ${isActive('/messaging/templates') ? 'active' : ''}`}
                            >
                                Predlošci
                            </Link>
                            <Link
                                to="/messaging/logs"
                                className={`sub-nav-item ${isActive('/messaging/logs') ? 'active' : ''}`}
                            >
                                Dnevnik i krediti
                            </Link>
                        </div>
                    </div>
                )}

                <Link
                    to="/profile"
                    className={`nav-item ${isActive('/profile') ? 'active' : ''}`}
                >
                    My Profile
                </Link>
            </nav>

            <div className="sidebar-footer">
                {businesses.length > 0 && (
                    <div className="business-selector">
                        <select
                            value={user?.activeBusinessId || ''}
                            onChange={handleSwitch}
                            className="bg-gray-800 text-white border border-gray-600 rounded p-1 w-full text-sm"
                        >
                            <option value="" disabled>Select Business</option>
                            {businesses.map(biz => (
                                <option key={biz.business_id} value={biz.business_id}>
                                    {biz.business_name} ({biz.role})
                                </option>
                            ))}
                            <option disabled>────────────────────</option>
                            <option value="ACTION_CREATE_JOIN">➕ Create / Join Business</option>
                        </select>
                    </div>
                )}

                <div className="user-info">
                    {user?.email}
                </div>

                <button
                    onClick={logout}
                    className="logout-btn"
                >
                    Logout
                </button>
            </div>
        </aside>
    );
}

export default Sidebar;
