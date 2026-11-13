import type { CSSProperties } from 'react';
import { destinations, remoteImage } from '@/data/destinations';

/** Online photo for a city (Unsplash), with the bundled local photo as fallback. */
export function cityPhoto(city: string, width = 900) {
  const d = destinations.find((x) => x.city === city);
  return {
    src: d ? remoteImage(d.photo, width) : `/images/kyoto.jpg`,
    fallback: `/images/${d?.file ?? 'kyoto'}.jpg`,
    caption: d?.caption ?? '',
  };
}

export const stagger = (index: number): CSSProperties => ({ animationDelay: `${Math.min(index, 8) * 55}ms` });
