'use client';
import { useEffect } from 'react';
export default function MobileShell() { useEffect(() => { if ('serviceWorker' in navigator)
    navigator.serviceWorker.register('/scout-sw.js').catch(() => { }); }, []); return null; }
