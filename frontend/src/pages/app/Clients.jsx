import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';
import { useDebounce } from '../../hooks/useDebounce';
import { toast } from 'sonner';
import './Clients.css';

export default function Clients() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const businessId = user?.activeBusinessId;

    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('last_visit_desc');

    // Pagination
    const [page, setPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const limit = 20;

    const debouncedSearch = useDebounce(searchQuery, 400);

    const fetchClients = useCallback(async () => {
        if (!businessId) return;

        setIsLoading(true);
        try {
            const params = {
                page,
                limit,
                q: debouncedSearch
            };

            // Map frontend sort to backend standard
            if (sortBy === 'last_visit_desc') params.sort = 'last_visit:desc';
            if (sortBy === 'last_visit_asc') params.sort = 'last_visit:asc';
            if (sortBy === 'visits_desc') params.sort = 'visits:desc';
            if (sortBy === 'name_asc') params.sort = 'name:asc';

            const res = await api.getBusinessClients(businessId, params);
            if (res.success) {
                setClients(res.data);
                // Assume the backend returns a meta object with total count, or fallback to length
                setTotalItems(res.meta?.total || res.data.length);
            }
        } catch (err) {
            console.error('Failed to fetch clients:', err);
            toast.error('Neuspješno preuzimanje klijenata');
        } finally {
            setIsLoading(false);
        }
    }, [businessId, page, limit, debouncedSearch, sortBy]);

    useEffect(() => {
        fetchClients();
         
    }, [fetchClients]);

    // Reset pagination on new search
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    const handleRowClick = (clientId) => {
        navigate(`/clients/${clientId}`);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Nikad';
        return new Date(dateString).toLocaleDateString('hr-HR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <div className="clients-page">
            <div className="clients-header">
                <h1>Klijenti</h1>
            </div>

            <div className="clients-toolbar">
                <div className="clients-search">
                    <span className="clients-search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Pretraži po imenu, telefonu..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="clients-sort">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        aria-label="Sortiranje klijenata"
                    >
                        <option value="last_visit_desc">Zadnja posjeta (Najnovije)</option>
                        <option value="last_visit_asc">Zadnja posjeta (Najstarije)</option>
                        <option value="visits_desc">Najviše posjeta</option>
                        <option value="name_asc">Po abecedi (A-Z)</option>
                    </select>
                </div>
            </div>

            <div className="clients-table-container">
                <table className="clients-table">
                    <thead>
                        <tr>
                            <th>Ime klijenta</th>
                            <th>Kontakt</th>
                            <th>Zadnji dolazak</th>
                            <th>Ukupno dolazaka</th>
                            <th>Nedolasci (No-show)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && clients.length === 0 ? (
                            <tr>
                                <td colSpan="5">
                                    <div className="clients-loading">
                                        <div className="spinner"></div>
                                        <span>Učitavanje baze klijenata...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : clients.length === 0 ? (
                            <tr>
                                <td colSpan="5">
                                    <div className="clients-empty">
                                        <h3>Nema pronađenih klijenata</h3>
                                        <p>Pokušajte prilagoditi pretragu ili dodajte novog klijenta.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            clients.map(client => (
                                <tr key={client.id} onClick={() => handleRowClick(client.id)}>
                                    <td className="client-name-cell">{client.name}</td>
                                    <td className="client-phone-cell">
                                        <div>{client.phone}</div>
                                        {client.email && <div style={{ fontSize: '12px', color: '#667085' }}>{client.email}</div>}
                                    </td>
                                    <td>{formatDate(client.last_appointment_at)}</td>
                                    <td>
                                        <span className="client-metric">
                                            {client.total_appointments} {client.total_appointments === 1 ? 'posjeta' : 'posjeta'}
                                        </span>
                                    </td>
                                    <td>
                                        {(client.no_show_count || 0) > 0 ? (
                                            <span className="client-metric danger">{client.no_show_count} nedolaska</span>
                                        ) : (
                                            <span className="client-metric">0</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination (only show if there's data or we're beyond page 1) */}
                {(clients.length > 0 || page > 1) && (
                    <div className="clients-pagination">
                        <div className="pagination-info">
                            Prikaz {clients.length} rezultata (Stranica {page})
                        </div>
                        <div className="pagination-controls">
                            <button
                                className="pagination-btn"
                                disabled={page === 1 || isLoading}
                                onClick={() => setPage(p => p - 1)}
                            >
                                Prethodna
                            </button>
                            <button
                                className="pagination-btn"
                                disabled={clients.length < limit || isLoading}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Sljedeća
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
