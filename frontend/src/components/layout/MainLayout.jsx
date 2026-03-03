import React from 'react';
import Header from './Header';

function MainLayout({ children }) {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header />
            <main style={{ flex: 1, background: '#f8f9fa' }}>
                {children}
            </main>
        </div>
    );
}

export default MainLayout;
