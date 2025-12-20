'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';

// This component listens for Firestore permission errors and throws them
// so that the Next.js development overlay can display them.
export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (error: Error) => {
      // Throw the error so Next.js can catch it and display it in the dev overlay
      throw error;
    };

    errorEmitter.on('permission-error', handleError);

  }, []);

  return null; // This component does not render anything
}
