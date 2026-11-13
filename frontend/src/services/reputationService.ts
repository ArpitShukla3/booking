import { reputationMock } from '@/services/mock/reputationMock';
import type { TravellerReputation, VoteDirection, VoteTally } from '@/types/reputation';

/**
 * Traveller reviews, ratings and votes. DEMO ONLY: backed by a mock adapter for now.
 * Components call this service, so swapping in a real API later only touches this file.
 */
export interface ReputationApi {
  getReputation(travellerId: string, viewerId: string | null): Promise<TravellerReputation>;
  vote(targetId: string, viewerId: string | null, current: VoteTally, direction: VoteDirection): Promise<VoteTally>;
}

export const reputationService: ReputationApi = reputationMock;
