import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTravellerStore } from '@/store/useTravellerStore';
export function CopyTravellerId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false); const [error, setError] = useState('');
  return <div><Button variant="outline" onClick={async () => { if (!useTravellerStore.getState().ensureValidSession()) return; try { await navigator.clipboard.writeText(id); setCopied(true); setError(''); } catch { setError('Copy is unavailable. Select and save the Traveller ID shown above.'); } }}><span aria-hidden="true">{copied ? <Check size={16} /> : <Copy size={16} />}</span>{copied ? 'Traveller ID copied' : 'Copy Traveller ID'}</Button><p role="status" className="field-hint mt-2">{copied ? 'Copied to clipboard.' : error}</p></div>;
}
