import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CalendarDays, ChevronRight, MapPin, Moon, NotebookPen, UsersRound, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, Form } from '@/components/ui/form';
import { ErrorState, PageContainer, Photo } from '@/components/shared/common';
import { ApiError } from '@/lib/api';
import { money, tripDates } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { groupService } from '@/services/groupService';
import { useTravellerStore } from '@/store/useTravellerStore';
import type { Destination } from '@/types/group';
import { createGroupSchema, nightsBetween, sizeLabel, WINDOW_END, WINDOW_START } from './schema';
import type { CreateGroupForm } from './schema';
import { SeatBar } from './parts';
import { cityPhoto, stagger } from './media';
import './groups.css';

const FIELDS: (keyof CreateGroupForm)[] = ['name', 'city', 'check_in', 'check_out', 'max_size', 'budget_inr', 'itinerary'];
const DEFAULTS: CreateGroupForm = { name: '', city: '', check_in: '', check_out: '', max_size: 3, budget_inr: undefined as unknown as number, itinerary: '' };

/** Live card that shows how the post will look to other travellers. */
function PostPreview({ control, destinations }: { control: Control<CreateGroupForm>; destinations: Destination[] }) {
  const v = useWatch({ control });
  const city = destinations.find((d) => d.city === v.city);
  const photo = cityPhoto(v.city || 'Kyoto', 700);
  const nights = nightsBetween(v.check_in ?? '', v.check_out ?? '');
  return (
    <aside className="card gp-preview" aria-label="Preview of your group post">
      <p className="gp-preview-label">Preview · how travellers will see it</p>
      <div className="gp-hero" style={{ minHeight: 170, margin: 12, borderRadius: 6 }}>
        <Photo key={photo.src} src={photo.src} fallback={photo.fallback} alt={city ? `${city.city}, ${city.country_name}` : 'Choose a destination'} className="gp-fade" />
        <div className="gp-hero-body">
          <h3 style={{ color: '#fff', fontSize: 18 }}>{v.name?.trim() || 'Your group name'}</h3>
          <p>{city ? `${city.city}, ${city.country_name}` : 'Pick a destination'}</p>
        </div>
      </div>
      <dl style={{ padding: '4px 16px 16px', display: 'grid', gap: 10 }}>
        <div className="icon-line" style={{ margin: 0 }}><CalendarDays size={15} aria-hidden="true" />
          {v.check_in && v.check_out && nights > 0 ? `${tripDates(v.check_in, v.check_out)} · ${nights} night${nights === 1 ? '' : 's'}` : 'Choose your dates'}
        </div>
        <div className="icon-line" style={{ margin: 0 }}><UsersRound size={15} aria-hidden="true" />{sizeLabel(v.max_size ?? 1)} · {v.max_size ?? 1} in total</div>
        <SeatBar members={1} max={v.max_size ?? 1} />
        <div className="gp-price" style={{ marginTop: 6 }}>
          <small>Approx budget per person</small>
          <strong>{v.budget_inr && v.budget_inr > 0 ? money(v.budget_inr) : '₹ —'}</strong>
        </div>
      </dl>
    </aside>
  );
}

function CreateGroupForm({ destinations }: { destinations: Destination[] }) {
  const navigate = useNavigate();
  const [formError, setFormError] = useState('');
  const form = useForm<CreateGroupForm>({ resolver: zodResolver(createGroupSchema), defaultValues: DEFAULTS, mode: 'onTouched' });
  const { register, control, setError, setFocus, formState: { errors, isSubmitting } } = form;
  const checkIn = useWatch({ control, name: 'check_in' });
  const checkOut = useWatch({ control, name: 'check_out' });
  const itinerary = useWatch({ control, name: 'itinerary' }) ?? '';
  const nights = nightsBetween(checkIn, checkOut);
  const a11y = (name: keyof CreateGroupForm) => ({ 'aria-invalid': !!errors[name], 'aria-describedby': errors[name] ? `${name}-error` : undefined });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError('');
    if (!useTravellerStore.getState().ensureValidSession()) { navigate('/login', { state: { from: '/groups/new' } }); return; }
    try {
      const group = await groupService.createGroup(values);
      navigate(`/groups/${group.group_id}`, { state: { created: true } });
    } catch (error) {
      if (error instanceof ApiError) {
        const known = Object.entries(error.fields).filter(([f]) => FIELDS.includes(f as keyof CreateGroupForm));
        for (const [field, message] of known) setError(field as keyof CreateGroupForm, { type: 'server', message });
        if (known.length) setFocus(known[0][0] as keyof CreateGroupForm);
        if (error.status === 401) { setFormError('Your sign-in has expired. Sign in again to post the group.'); return; }
      }
      setFormError(error instanceof Error ? error.message : 'Could not create the group. Please try again.');
    }
  });

  return (
    <div className="gp-create">
      <Form {...form}>
        <form className="card gp-form-card gp-rise" noValidate onSubmit={onSubmit} aria-label="Create a group trip">
          <h2>Post your group trip</h2>
          <p className="text-muted-foreground">Travellers with matching dates, budget and interests will find it straight away.</p>

          <section className="gp-form-section" style={stagger(1)}>
            <h3><NotebookPen size={18} aria-hidden="true" />Name your group</h3>
            <Field id="name" label="Group name" error={errors.name?.message}>
              <Input id="name" placeholder="e.g. Kyoto temples & street food" autoComplete="off" maxLength={100} {...register('name')} {...a11y('name')} />
            </Field>
          </section>

          <section className="gp-form-section">
            <h3 id="city-label"><MapPin size={18} aria-hidden="true" />Where are you going?</h3>
            <Controller name="city" control={control} render={({ field }) => (
              <div role="radiogroup" aria-labelledby="city-label" className="gp-cities" {...a11y('city')}>
                {destinations.map((d, i) => {
                  const photo = cityPhoto(d.city, 400);
                  const checked = field.value === d.city;
                  return (
                    <button key={d.city} type="button" role="radio" aria-checked={checked} className="gp-city gp-rise" style={stagger(i)}
                      ref={i === 0 ? field.ref : undefined} tabIndex={checked || (!field.value && i === 0) ? 0 : -1}
                      onClick={() => field.onChange(d.city)}
                      onKeyDown={(e) => {
                        const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
                        if (!step) return;
                        e.preventDefault();
                        const next = destinations[(i + step + destinations.length) % destinations.length];
                        field.onChange(next.city);
                        (e.currentTarget.parentElement?.children[(i + step + destinations.length) % destinations.length] as HTMLElement | undefined)?.focus();
                      }}>
                      <Photo src={photo.src} fallback={photo.fallback} alt="" />
                      <span>{d.city}<small>{d.country_name}</small></span>
                    </button>
                  );
                })}
              </div>
            )} />
            {errors.city ? <p className="field-error" id="city-error" role="alert">{errors.city.message}</p> : null}
          </section>

          <section className="gp-form-section">
            <h3><CalendarDays size={18} aria-hidden="true" />When?</h3>
            <div className="gp-date-box">
              <Field id="check_in" label="Check-in">
                <Input id="check_in" type="date" min={WINDOW_START} max={WINDOW_END} {...register('check_in')} {...a11y('check_in')} />
              </Field>
              <Field id="check_out" label="Check-out">
                <Input id="check_out" type="date" min={checkIn || WINDOW_START} max={WINDOW_END} {...register('check_out')} {...a11y('check_out')} />
              </Field>
            </div>
            {errors.check_in ? <p className="field-error" id="check_in-error" role="alert">{errors.check_in.message}</p> : null}
            {errors.check_out ? <p className="field-error" id="check_out-error" role="alert">{errors.check_out.message}</p> : null}
            <p className="field-hint">Trips run between 1 and 20 April 2027.</p>
            {nights > 0 ? <span className="gp-nights gp-rise" key={nights}><Moon size={14} aria-hidden="true" />{nights} night{nights === 1 ? '' : 's'}</span> : null}
          </section>

          <section className="gp-form-section">
            <h3 id="size-label"><UsersRound size={18} aria-hidden="true" />How many people in total?</h3>
            <Controller name="max_size" control={control} render={({ field }) => (
              <div role="radiogroup" aria-labelledby="size-label" className="gp-sizes">
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={field.value === n} className="gp-size"
                    ref={n === 1 ? field.ref : undefined} onClick={() => field.onChange(n)}>
                    <strong>{n}</strong><span>{sizeLabel(n)}</span>
                  </button>
                ))}
              </div>
            )} />
            <p className="field-hint">Including you. Up to 4 travellers.</p>
            {errors.max_size ? <p className="field-error" id="max_size-error" role="alert">{errors.max_size.message}</p> : null}
          </section>

          <section className="gp-form-section">
            <h3><Wallet size={18} aria-hidden="true" />Budget &amp; plan</h3>
            <Field id="budget_inr" label="Approx budget per person (INR)" error={errors.budget_inr?.message} hint="Whole rupees. Used to match travellers with a similar budget.">
              <div className="gp-money"><span aria-hidden="true">₹</span>
                <Input id="budget_inr" type="number" inputMode="numeric" min={1} step={1000} placeholder="60000" {...register('budget_inr', { valueAsNumber: true })} {...a11y('budget_inr')} />
              </div>
            </Field>
            <Field id="itinerary" label="Proposed itinerary (optional)" error={errors.itinerary?.message}>
              <textarea id="itinerary" className="control gp-textarea" maxLength={4000} placeholder={'Day 1: Fushimi Inari at sunrise, Nishiki market lunch\nDay 2: Arashiyama bamboo grove…'} {...register('itinerary')} {...a11y('itinerary')} />
            </Field>
            <p className="gp-counter">{itinerary.length} / 4000</p>
          </section>

          {formError ? <p className="gp-form-error" role="alert">{formError}</p> : null}
          <div className="gp-submit-row">
            <Button type="submit" size="lg" className="btn-main" disabled={isSubmitting}>
              {isSubmitting ? 'Posting your group…' : 'Post group'}<ArrowRight size={18} aria-hidden="true" />
            </Button>
            <Button type="button" variant="outline" size="lg" asChild><Link to="/my-groups">Cancel</Link></Button>
          </div>
        </form>
        <PostPreview control={control} destinations={destinations} />
      </Form>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="gp-create" role="status" aria-label="Loading form">
      <div className="card gp-form-card" style={{ display: 'grid', gap: 16 }}>
        <div className="gp-skel" style={{ height: 28, width: '50%' }} />
        <div className="gp-skel" style={{ height: 44 }} />
        <div className="gp-skel" style={{ height: 104 }} />
        <div className="gp-skel" style={{ height: 60 }} />
      </div>
      <div className="card gp-skel" style={{ height: 320 }} />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export default function CreateGroupPage() {
  const destinations = useAsync(() => groupService.listDestinations(), 'destinations');
  return (
    <PageContainer className="gp-page">
      <nav className="gp-breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Home</Link><ChevronRight size={12} aria-hidden="true" />
        <Link to="/my-groups">My groups</Link><ChevronRight size={12} aria-hidden="true" /><span>New group</span>
      </nav>
      <div className="gp-hero gp-rise">
        <Photo src={cityPhoto('Kyoto', 1600).src} fallback="/images/kyoto.jpg" alt="Lanterns along a street in Kyoto" loading="eager" />
        <div className="gp-hero-body">
          <h1>Create a group trip</h1>
          <p>Share the cost, share the stories. Recruit up to 3 travel companions.</p>
        </div>
      </div>
      {destinations.loading ? <FormSkeleton />
        : destinations.error || !destinations.data ? <div style={{ marginTop: 24 }}><ErrorState error={destinations.error} retry={destinations.retry} /></div>
        : <CreateGroupForm destinations={destinations.data} />}
    </PageContainer>
  );
}
