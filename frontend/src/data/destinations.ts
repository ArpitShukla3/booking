export const destinations = [
  {
    city: "Tokyo",
    country: "Japan",
    caption: "Bright lights, endless discoveries",
    photo: "photo-1519608487953-e999c86e7455",
    file: "tokyo",
  },
  {
    city: "Kyoto",
    country: "Japan",
    caption: "Slow mornings and ancient temples",
    photo: "photo-1493976040374-85c8e12f0c0e",
    file: "kyoto",
  },
  {
    city: "Osaka",
    country: "Japan",
    caption: "Come hungry. Leave happy.",
    photo: "photo-1590559899731-a382839e5549",
    file: "osaka",
  },
  {
    city: "Dubai",
    country: "United Arab Emirates",
    caption: "A little adventure, a little luxury",
    photo: "photo-1512453979798-5ea266f8880c",
    file: "dubai",
  },
  {
    city: "Abu Dhabi",
    country: "United Arab Emirates",
    caption: "Culture, coastlines and calm",
    photo: "photo-1512632578888-169bbbc64f33",
    file: "abu-dhabi",
  },
];
export const destinationImage = (city: string) =>
  `/images/${destinations.find((d) => d.city === city)?.file || "kyoto"}.jpg`;
export const remoteImage = (photo: string, width = 900) =>
  `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${width}&q=85`;
