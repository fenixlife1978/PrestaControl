
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

  const settingsRef = firestore ? doc(firestore, 'company_settings', 'main') : null;
  const [settingsDoc, loading, error] = useDocument(settingsRef);
  const [publicLogoUrl, setPublicLogoUrl] = useState("https://i.ibb.co/bF05tG9/bus-image-no-bg.png");

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const style = getComputedStyle(document.documentElement);
        let url = style.getPropertyValue('--public-logo-url').trim();
        // Clean up the URL from the CSS variable
        if (url.startsWith('url("') && url.endsWith('")')) {
            url = url.substring(5, url.length - 2);
        }
        if (url) {
            setPublicLogoUrl(url);
        }
    }
  }, []);

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

  // If there's a logged-in user, prioritize the logo from Firestore.
  // Otherwise, use the public URL from the CSS variable.
  const finalSrc = currentUser ? (logoUrl || publicLogoUrl) : publicLogoUrl;

  return (
    <img
      src={finalSrc}
      alt="Logo"
      className={cn("h-24 w-auto", className)}
      onError={(e) => {
        // Fallback if the logo fails to load for any reason
        (e.target as HTMLImageElement).src = 'https://i.ibb.co/bF05tG9/bus-image-no-bg.png';
      }}
    />
  );
}
