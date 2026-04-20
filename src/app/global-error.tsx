'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error]', error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: '#fef2f2' }}>
          <div style={{ textAlign: 'center', padding: '2rem', background: '#fff', borderRadius: '0.75rem', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔥</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Critical Error</h1>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Something went very wrong. Please try again.</p>
            <button
              onClick={() => reset()}
              style={{ padding: '0.75rem 1.5rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 500, fontSize: '1rem', marginBottom: '0.75rem', width: '100%' }}
            >
              Try Again
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{ padding: '0.75rem 1.5rem', background: '#e5e7eb', color: '#111827', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 500, fontSize: '1rem', width: '100%' }}
            >
              Go to Home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
