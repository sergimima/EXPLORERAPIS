'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function TokenSettingsRedirect() {
  const params = useParams();
  const router = useRouter();
  const tokenId = params.id as string;

  useEffect(() => {
    // Redirect to general settings by default
    router.replace(`/settings/tokens/${tokenId}/general`);
  }, [tokenId, router]);

  return (
    <div className="flex items-center justify-center p-12">
      <div className="text-muted-foreground">Redirigiendo...</div>
    </div>
  );
}
