import { Check, Hotel, Lock, PartyPopper, Send, UsersRound } from 'lucide-react';
import type { CSSProperties } from 'react';
import { stagger } from './media';
import type { Group } from '@/types/group';
import { stageLabel, tripSteps } from './tripFlow';
import type { HotelProgress, TripStep } from './tripFlow';

const PILL_CLASS: Record<Group['stage'], string> = {
  LOBBY_OPEN: 'gp-pill--open', LOBBY_FULL: 'gp-pill--full', HOTEL_SHORTLISTED: 'gp-pill--hotel', BOOKED: 'gp-pill--booked',
};

/** Trip status from the backend. `key` re-mounts on change so a live update pops in. */
export function StagePill({ stage }: { stage: Group['stage'] }) {
  return (
    <span key={stage} className={`gp-pill ${PILL_CLASS[stage] ?? 'gp-pill--open'}`}>
      {stage === 'BOOKED' ? <Lock size={11} aria-hidden="true" /> : <span className="gp-pill-dot" aria-hidden="true" />}
      {stageLabel(stage)}
    </span>
  );
}

/** Members bar: filled seats vs max_size. */
export function SeatBar({ members, max }: { members: number; max: number }) {
  return (
    <div className="gp-seats" role="img" aria-label={`${members} of ${max} places filled`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`gp-seat ${i < members ? 'is-filled' : ''}`} style={{ transitionDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

const STEP_ICONS: Record<string, typeof Check> = { posted: Send, lobby: UsersRound, complete: PartyPopper, hotel: Hotel, booked: Lock };

function StepIcon({ step }: { step: TripStep }) {
  const Icon = step.state === 'done' ? Check : STEP_ICONS[step.key];
  return <span className="gp-step-icon" aria-hidden="true"><Icon size={16} /></span>;
}

/** The trip journey: posted → lobby filling → lobby complete → hotel fixed → booked. */
export function TripProgress({ group, compact = false, hotel }: { group: Pick<Group, 'stage' | 'members_count' | 'max_size' | 'spots_left'> & { hotel_status?: Group['hotel_status'] }; compact?: boolean; hotel?: HotelProgress }) {
  const steps = tripSteps(group, hotel);
  const doneCount = steps.filter((s) => s.state === 'done').length;
  const progress = ((doneCount + (steps.some((s) => s.state === 'current') ? 0.5 : 0)) / steps.length) * 100;
  return (
    <ol className={`gp-flow ${compact ? 'gp-flow--compact' : ''}`} aria-label="Trip progress" style={{ '--gp-progress': `${progress}%` } as CSSProperties}>
      {steps.map((step, i) => (
        <li key={step.key} className={`gp-step is-${step.state}`} style={stagger(i)} aria-current={step.state === 'current' ? 'step' : undefined}>
          <StepIcon step={step} />
          <div className="gp-step-text">
            <strong>{step.title}</strong>
            {!compact ? <span>{step.detail}</span> : null}
          </div>
          <span className="sr-only">({step.state})</span>
        </li>
      ))}
    </ol>
  );
}
