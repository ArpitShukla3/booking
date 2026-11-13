import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, UserRound, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Select } from '@/components/ui/input';
import { Field, Form } from '@/components/ui/form';
import { ErrorState, LoadingState, PageContainer } from '@/components/shared/common';
import { useAsync } from '@/lib/useAsync';
import { ApiError } from '@/lib/api';
import { travellerService } from '@/services/travellerService';
import { useTravellerStore } from '@/store/useTravellerStore';
import type { Interest, SignupInput, Traveller } from '@/types/traveller';
import { createSignupSchema } from './schemas';
import { CopyTravellerId } from './CopyTravellerId';

function SignupSuccess({ traveller }: { traveller: Traveller }) {
  const warning = useTravellerStore(state => state.storageWarning);
  return <PageContainer className="identity-page"><section className="card signup-success"><CheckCircle2 size={50} aria-hidden="true" /><h1>Your traveller profile is ready!</h1><p>Welcome, {traveller.name}. Your profile is saved in PostgreSQL.</p><div className="traveller-id-display"><span>Your Traveller ID</span><strong data-testid="traveller-id" translate="no">{traveller.traveller_id}</strong></div><p>Save your Traveller ID. You’ll need it to sign in again after your remembered session expires.</p>{warning ? <p className="identity-notice" role="status">{warning}</p> : <p className="field-hint">You are already signed in. This browser will remember you for seven days.</p>}<CopyTravellerId id={traveller.traveller_id} /><Button asChild size="lg"><Link to="/dashboard">Continue to Dashboard <ArrowRight size={16} aria-hidden="true" /></Link></Button></section></PageContainer>;
}
function SignupForm({ interests }: { interests: Interest[] }) {
  const [error, setError] = useState('');
  const loading = useTravellerStore(state => state.isLoading);
  const form = useForm<SignupInput>({ resolver: zodResolver(createSignupSchema(interests.map(i => i.interest))), defaultValues: { name: '', age: undefined, gender: undefined, home_city: '', home_airport: '', interests: [], gender_preference: 'ANY' } });
  const { register, control, formState: { errors } } = form;
  const a11y = (name: keyof SignupInput) => ({ 'aria-invalid': !!errors[name], 'aria-describedby': errors[name] ? `${name}-error` : undefined });
  return <Form {...form}><form className="identity-form" noValidate onSubmit={form.handleSubmit(async values => { setError(''); try { await useTravellerStore.getState().signup(values); } catch (error) { if (error instanceof ApiError) { for (const [field, message] of Object.entries(error.fields)) if (field in form.getValues()) form.setError(field as keyof SignupInput, { type: 'server', message }); const first = Object.keys(error.fields).find(field => field in form.getValues()); if (first) form.setFocus(first as keyof SignupInput); } setError(error instanceof Error ? error.message : 'Please try again.'); } })}>
    <div className="identity-form-grid"><Field id="name" label="Full Name" error={errors.name?.message}><Input id="name" autoComplete="name" placeholder="e.g. Rahul Kumar…" {...register('name')} {...a11y('name')} /></Field><Field id="age" label="Age" error={errors.age?.message}><Input id="age" type="number" inputMode="numeric" min="1" max="120" autoComplete="off" {...register('age', { valueAsNumber: true })} {...a11y('age')} /></Field><Field id="gender" label="Gender" error={errors.gender?.message}><Select id="gender" {...register('gender')} {...a11y('gender')}><option value="">Choose gender</option><option value="MALE">Male</option><option value="FEMALE">Female</option></Select></Field><Field id="home_city" label="Home City" error={errors.home_city?.message}><Input id="home_city" autoComplete="address-level2" placeholder="e.g. Delhi…" {...register('home_city')} {...a11y('home_city')} /></Field><Field id="home_airport" label="Home Airport" hint="Three-letter IATA code" error={errors.home_airport?.message}><Input id="home_airport" autoComplete="off" spellCheck={false} maxLength={3} placeholder="e.g. DEL…" {...register('home_airport')} {...a11y('home_airport')} /></Field><Field id="gender_preference" label="Gender Preference" error={errors.gender_preference?.message}><Select id="gender_preference" {...register('gender_preference')} {...a11y('gender_preference')}><option value="ANY">Any gender</option><option value="SAME_GENDER">Same gender only</option></Select></Field></div>
    <Controller name="interests" control={control} render={({ field }) => <fieldset className="signup-interests"><legend>Interests</legend><p className="field-hint">Choose what you enjoy. Matching later needs at least two shared interests.</p><div>{interests.map((interest, index) => <label htmlFor={`signup-${interest.interest}`} className="interest-option" key={interest.interest}><Checkbox id={`signup-${interest.interest}`} ref={index === 0 ? field.ref : undefined} checked={field.value.includes(interest.interest)} onCheckedChange={checked => field.onChange(checked ? [...field.value, interest.interest] : field.value.filter(i => i !== interest.interest))} aria-invalid={!!errors.interests} aria-describedby={errors.interests ? 'interests-error' : undefined} />{interest.label}</label>)}</div>{errors.interests ? <p className="field-error" role="alert" id="interests-error">{errors.interests.message}</p> : null}</fieldset>} />
    {error ? <p className="field-error" role="alert">{error}</p> : null}<Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? 'Creating your profile…' : 'Create traveller profile'}<ArrowRight size={17} aria-hidden="true" /></Button><p className="identity-demo">Demo identity only. No password, email or OTP. Your profile remains saved when your seven-day remembered sign-in expires.</p>
  </form></Form>;
}
export default function SignupPage() {
  const traveller = useTravellerStore(state => state.traveller);
  const initialized = useTravellerStore(state => state.isInitialized);
  const catalog = useAsync(() => travellerService.getInterests(), 'signup-interests');
  if (!initialized) return <PageContainer className="page-content"><LoadingState /></PageContainer>;
  if (traveller) return <SignupSuccess traveller={traveller} />;
  return <PageContainer className="identity-page"><div className="identity-layout signup-layout"><div className="identity-intro"><span className="feature-label"><UserRound size={19} aria-hidden="true" />Group Travel Matcher</span><h1>Your people.<br />Your kind of trip.</h1><p>Tell us a little about yourself and start your next travel chapter.</p><img src="/images/osaka.jpg" alt="Osaka’s lively streets, ready to explore" width={700} height={500} /><p className="identity-caption">One profile. A world of shared possibilities.</p><p className="identity-crosslink">Already have a Traveller ID? <Link className="text-link" to="/login">Sign in</Link></p></div><section className="card identity-card"><h2>Create your traveller profile</h2><p className="text-muted-foreground mt-2 mb-6">Your Traveller ID is generated when your profile is saved.</p>{catalog.loading ? <LoadingState /> : catalog.error ? <ErrorState error={catalog.error} retry={catalog.retry} /> : catalog.data?.length ? <SignupForm interests={catalog.data} /> : <ErrorState error={new Error('The interests catalog is empty. Ask the project maintainer to run the database setup.')} retry={catalog.retry} />}</section></div></PageContainer>;
}
