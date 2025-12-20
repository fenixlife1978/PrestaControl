
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useDocument } from 'react-firebase-hooks/firestore';
import { doc } from 'firebase/firestore';
import { useFirebase, useFirestore } from '@/firebase';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type CompanySettings = {
  logoUrl?: string;
};

export function Logo({ className }: { className?: string }) {
  const { currentUser, loading: authLoading } = useFirebase();
  const firestore = useFirestore();

  // Solo intenta obtener la referencia si hay un usuario.
  const settingsRef = currentUser && firestore ? doc(firestore, 'company_settings', 'main') : null;
  const [settingsDoc, loading, error] = useDocument(settingsRef);
  
  const [publicLogoUrl, setPublicLogoUrl] = useState("https://i.ibb.co/L6fK5bC/bus-image.png");

  useEffect(() => {
    if (typeof window !== 'undefined' && !currentUser) {
        const style = getComputedStyle(document.documentElement);
        let url = style.getPropertyValue('--public-logo-url').trim();
        if (url.startsWith('url("') && url.endsWith('")')) {
            url = url.substring(5, url.length - 2);
        }
        if (url && url !== "none" && url !== "") {
            setPublicLogoUrl(url);
        }
    }
  }, [currentUser]);

  const logoUrl = useMemo(() => {
    if (currentUser && settingsDoc?.exists()) {
      const data = settingsDoc.data() as CompanySettings;
      return data.logoUrl;
    }
    return null;
  }, [settingsDoc, currentUser]);

  const isLoading = authLoading || (currentUser && loading);

  if (isLoading) {
    return <Skeleton className={cn("h-24 w-24 rounded-full", className)} />;
  }
  
  if (error && currentUser) {
    console.error("Error loading logo from Firestore:", error);
  }

  // Si hay un usuario logueado, se usa su logo o el por defecto. Si no, se usa el público.
  const finalSrc = currentUser ? (logoUrl || publicLogoUrl) : publicLogoUrl;

  return (
    <img
      src={finalSrc}
      alt="Logo"
      className={cn("h-24 w-auto", className)}
      onError={(e) => {
        (e.target as HTMLImageElement).src = 'https://i.ibb.co/L6fK5bC/bus-image.png';
      }}
    />
  );
}
