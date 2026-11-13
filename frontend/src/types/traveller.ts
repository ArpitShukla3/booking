export interface Traveller {
  traveller_id: string;
  name: string;
  age: number | null;
  gender: 'MALE' | 'FEMALE';
  home_city: string;
  home_airport: string;
  interests: string[];
  gender_preference: 'ANY' | 'SAME_GENDER';
}
export interface SignupInput extends Omit<Traveller, 'traveller_id' | 'age'> { age: number }
export interface Interest { interest: string; label: string; category: string }
