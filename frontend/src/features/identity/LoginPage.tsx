import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { UserRound, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, Form } from '@/components/ui/form';
import { LoadingState, PageContainer } from '@/components/shared/common';
import { useTravellerStore } from '@/store/useTravellerStore';
import { loginSchema } from './schemas';
export default function LoginPage() {
  const traveller = useTravellerStore(state => state.traveller); const initialized = useTravellerStore(state => state.isInitialized); const loading = useTravellerStore(state => state.isLoading); const notice = useTravellerStore(state => state.notice);
  const [error, setError] = useState(''); const navigate = useNavigate();
  const form = useForm<{ traveller_id: string }>({ resolver: zodResolver(loginSchema), defaultValues: { traveller_id: '' } });
  if (!initialized) return <PageContainer className="page-content"><LoadingState /></PageContainer>;
  if (traveller) return <Navigate to="/dashboard" replace />;
  return <PageContainer className="identity-page"><div className="identity-layout"><div className="identity-intro"><span className="feature-label"><UserRound size={19} aria-hidden="true" />Your next chapter</span><h1>Welcome back</h1><p>Enter your Traveller ID to continue your travel plans.</p><img src="/images/kyoto.jpg" alt="Kyoto’s traditional streets at sunset" width={700} height={500} /><p className="identity-caption">Good plans are worth coming back to.</p></div><section className="card identity-card"><h2>Sign in with your Traveller ID</h2><p className="text-muted-foreground mt-2 mb-6">No password, email or OTP needed.</p>{notice ? <p role="status" className="identity-notice">{notice}</p> : null}<Form {...form}><form noValidate onSubmit={form.handleSubmit(async values => { setError(''); try { await useTravellerStore.getState().signInWithId(values.traveller_id); navigate('/dashboard', { replace: true }); } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); } })}><Field id="traveller_id" label="Traveller ID" error={form.formState.errors.traveller_id?.message}><Input id="traveller_id" autoComplete="username" spellCheck={false} placeholder="e.g. T-025…" {...form.register('traveller_id')} aria-invalid={!!form.formState.errors.traveller_id} aria-describedby={form.formState.errors.traveller_id ? 'traveller_id-error' : 'id-hint'} /></Field><p id="id-hint" className="field-hint mt-2">Use the ID shown when you created your profile.</p>{error ? <p className="field-error mt-4" role="alert">{error}</p> : null}<Button className="w-full mt-6" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}<ArrowRight size={16} aria-hidden="true" /></Button></form></Form><p className="identity-crosslink">New here? <Link className="text-link" to="/signup">Create your traveller profile</Link></p><p className="identity-demo">Demo identity only. Traveller IDs are not secure credentials. This device remembers your sign-in for seven days.</p></section></div></PageContainer>;
}
