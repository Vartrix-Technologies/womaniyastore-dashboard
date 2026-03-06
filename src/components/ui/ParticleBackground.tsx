// src/components/ui/ParticleBackground.tsx
'use client';

import { useEffect, useState } from 'react';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;
const a = s.accent;

export default function ParticleBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Animated gradient orbs - highly visible */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-white/20 rounded-full filter blur-3xl animate-blob" 
        style={{ boxShadow: '0 0 100px 40px rgba(255, 255, 255, 0.3)' }} />
      <div className="absolute top-20 right-10 w-80 h-80 bg-brand-300/40 rounded-full filter blur-2xl animate-blob animation-delay-2000" 
        style={{ boxShadow: '0 0 80px 30px rgba(103, 232, 249, 0.4)' }} />
      <div className={`absolute bottom-20 left-1/3 w-72 h-72 ${a.particleBg} rounded-full filter blur-2xl animate-blob animation-delay-4000`} 
        style={{ boxShadow: '0 0 90px 35px rgba(94, 234, 212, 0.4)' }} />
      <div className="absolute bottom-10 right-1/4 w-64 h-64 bg-white/15 rounded-full filter blur-xl animate-blob animation-delay-3000" 
        style={{ boxShadow: '0 0 70px 25px rgba(255, 255, 255, 0.25)' }} />
      
      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.2) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '4rem 4rem'
        }}
      />
    </div>
  );
}
