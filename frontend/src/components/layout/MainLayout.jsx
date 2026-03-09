import React from 'react';
import Sidebar from './Sidebar';

function MainLayout({ children }) {
    return (
        <div style={{ minHeight: '100vh', display: 'flex' }}>
            <Sidebar />
            <main style={{ flex: 1, background: '#f8f9fa', display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
                <div style={{ padding: '20px', flex: 1 }}>
                    {children}
                </div>
            </main>
        </div>
    );
}

export default MainLayout;
