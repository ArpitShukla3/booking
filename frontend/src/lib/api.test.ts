import { describe, expect, it } from 'vitest';
import { ApiError, apiClient } from './api';
describe('identity API error messages', () => {
  it('turns an actual timeout error code into a retryable message', async () => {
    await expect(apiClient.get('/timeout', { adapter: async () => { throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }); } })).rejects.toMatchObject({ status: 0, message: 'The request timed out. Please try again.' });
  });
  it('turns a connection failure into an understandable backend message', async () => {
    await expect(apiClient.get('/offline', { adapter: async () => { throw new Error('network'); } })).rejects.toMatchObject({ status: 0, message: 'Cannot reach the backend. Check your connection and try again.' });
  });
  it('preserves backend validation fields for the signup form', async () => {
    const error = await apiClient.post('/invalid', {}, { adapter: async () => { throw { response: { status: 400, data: { error: { message: 'Check your profile', fields: { interests: 'Unknown interest' } } } } }; } }).catch(error => error);
    expect(error).toBeInstanceOf(ApiError); expect(error.fields).toEqual({ interests: 'Unknown interest' });
  });
  it('retains safe database-unavailable messages and HTTP status', async () => {
    await expect(apiClient.get('/unavailable', { adapter: async () => { throw { response: { status: 503, data: { error: { message: 'The database is temporarily unavailable. Please try again.' } } } }; } })).rejects.toMatchObject({ status: 503, message: 'The database is temporarily unavailable. Please try again.' });
  });
});
