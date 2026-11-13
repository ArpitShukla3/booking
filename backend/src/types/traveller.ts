export interface TravellerInput {
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE';
  home_city: string;
  home_airport: string;
  interests: string[];
  gender_preference: 'ANY' | 'SAME_GENDER';
}
export interface Traveller extends Omit<TravellerInput, 'age'> { traveller_id: string; age: number | null }
export interface Interest { interest: string; label: string; category: string }
