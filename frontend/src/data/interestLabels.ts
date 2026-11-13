import interests from "./interests.json";
export const interestLabel = (id: string) =>
  interests.find((interest) => interest.interest === id)?.label || id;
