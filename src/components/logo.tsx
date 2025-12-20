
'use client';

import { useMemo } from 'react';
import { useDocument } from 'react-firebase-hooks/firestore';
import { doc } from 'firebase/firestore';
import { useFirebase, useFirestore } from '@/firebase';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type CompanySettings = {
  logoUrl?: string;
};

export function Logo({ className }: { className?: string }) {
  const { currentUser } = useFirebase(); // Use the hook that provides the user
  const firestore = useFirestore();
  
  // Only create the ref if there's a user.
  const settingsRef = firestore && currentUser ? doc(firestore, 'company_settings', 'main') : null;
  const [settingsDoc, loading, error] = useDocument(settingsRef);

  const logoUrl = useMemo(() => {
    if (settingsDoc?.exists()) {
      const data = settingsDoc.data() as CompanySettings;
      return data.logoUrl;
    }
    return null;
  }, [settingsDoc]);

  // If there's no current user, don't even try to show a skeleton or error, just use the default.
  if (!currentUser) {
     return (
       <img
        src="https://i.ibb.co/bF05tG9/bus-image-no-bg.png"
        alt="Logo"
        className={cn("h-24 w-auto", className)}
      />
    )
  }

  const finalSrc = logoUrl || "https://i.ibb.co/bF05tG9/bus-image-no-bg.png";

  if (loading) {
    return <Skeleton className={cn("h-24 w-24", className)} />;
  }
  
  if (error) {
    console.error("Error loading logo:", error);
    // Fallback to default logo on error
    return (
       <img
        src="https://i.ibb.co/bF05tG9/bus-image-no-bg.png"
        alt="Logo"
        className={cn("h-24 w-auto", className)}
      />
    )
  }

  return (
    <img
      src={finalSrc}
      alt="Logo"
      className={cn("h-24 w-auto", className)}
    />
  );
}
