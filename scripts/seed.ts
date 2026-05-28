/**
 * scripts/seed.ts
 *
 * Pobla la base de datos con datos sintéticos derivados de los mockups en
 * docs/designs/. Idempotente: si ya existen los users, los reutiliza.
 *
 * Uso:
 *   pnpm db:seed
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env.
 */

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_PASSWORD = 'LuxeEstateSeed2026!';

type Role = Database['public']['Enums']['user_role'];

type SeedUser = {
  email: string;
  fullName: string;
  role: Role;
  city?: string;
  bio?: string;
};

const USERS: SeedUser[] = [
  {
    email: 'admin@luxe-estate.test',
    fullName: 'Elias Thorne',
    role: 'admin',
    city: 'San Francisco, CA',
  },
  {
    email: 'sarah@luxe-estate.test',
    fullName: 'Sarah Miller',
    role: 'broker',
    city: 'New York, NY',
    bio: 'Senior Broker especializada en propiedades de lujo en la costa este.',
  },
  {
    email: 'marcus@luxe-estate.test',
    fullName: 'Marcus Chen',
    role: 'agent',
    city: 'Vancouver, BC',
  },
  {
    email: 'david@luxe-estate.test',
    fullName: "David O'Conner",
    role: 'agent',
    city: 'Seattle, WA',
  },
  {
    email: 'sarah.jenkins@luxe-estate.test',
    fullName: 'Sarah Jenkins',
    role: 'agent',
    city: 'Palo Alto, CA',
    bio: 'Top Rated Agent en Bay Area. 10+ años de experiencia.',
  },
  {
    email: 'michael.ross@luxe-estate.test',
    fullName: 'Michael Ross',
    role: 'agent',
    city: 'Aspen, CO',
  },
  {
    email: 'elena@luxe-estate.test',
    fullName: 'Elena Richardson',
    role: 'user',
    city: 'San Francisco, CA',
  },
  {
    email: 'anna@luxe-estate.test',
    fullName: 'Anna Koval',
    role: 'user',
    city: 'Portland, OR',
  },
];

type Amenity = Database['public']['Enums']['amenity_key'];

type SeedProperty = {
  ownerEmail: string;
  title: string;
  description: string;
  price: number;
  listingType: Database['public']['Enums']['listing_type'];
  listingStatus: Database['public']['Enums']['listing_status'];
  propertyType: Database['public']['Enums']['property_type'];
  addressLine: string;
  city: string;
  state?: string;
  country?: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  parkingSpaces?: number;
  yearBuilt?: number;
  isFeatured?: boolean;
  isPremium?: boolean;
  previousPrice?: number;
  publishedDaysAgo: number;
  amenities: Amenity[];
  /** Zona horaria IANA de la propiedad (ej. 'America/Los_Angeles'). Si no
   *  se especifica, se usa el default de la DB ('America/Mexico_City'). */
  timezone?: string;
};

const PROPERTIES: SeedProperty[] = [
  {
    ownerEmail: 'sarah.jenkins@luxe-estate.test',
    title: 'The Glass Pavilion',
    description:
      'Villa moderna con piscina infinita y paredes de vidrio de piso a techo. Diseñada con énfasis en la vida interior-exterior.',
    price: 5250000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'villa',
    addressLine: '1234 Sunset Blvd',
    city: 'Beverly Hills',
    state: 'CA',
    country: 'USA',
    bedrooms: 5,
    bathrooms: 4.5,
    areaSqm: 420,
    parkingSpaces: 3,
    yearBuilt: 2021,
    isFeatured: true,
    isPremium: true,
    publishedDaysAgo: 14,
    amenities: ['pool', 'gym', 'smart_home', 'wine_cellar', 'ev_charging'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'marcus@luxe-estate.test',
    title: 'Azure Heights Penthouse',
    description:
      'Penthouse con vistas panorámicas a la bahía. Acabados de mármol importado y cocina chef profesional.',
    price: 3800000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'penthouse',
    addressLine: '888 Granville St',
    city: 'Vancouver',
    state: 'BC',
    country: 'Canada',
    bedrooms: 3,
    bathrooms: 3,
    areaSqm: 210,
    parkingSpaces: 2,
    yearBuilt: 2019,
    isFeatured: true,
    publishedDaysAgo: 3,
    amenities: ['gym', 'parking', 'air_conditioning', 'smart_home'],
    timezone: 'America/Vancouver',
  },
  {
    ownerEmail: 'david@luxe-estate.test',
    title: 'Modern Family Home',
    description:
      'Casa familiar moderna en barrio tranquilo. Jardín amplio, garage doble y cerca de buenas escuelas.',
    price: 850000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'house',
    addressLine: '123 Pine St',
    city: 'Seattle',
    state: 'WA',
    country: 'USA',
    bedrooms: 3,
    bathrooms: 2,
    areaSqm: 120,
    parkingSpaces: 2,
    yearBuilt: 2015,
    publishedDaysAgo: 5,
    amenities: ['garden', 'parking', 'central_heating'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'sarah@luxe-estate.test',
    title: 'Urban Loft',
    description:
      'Loft urbano con techos altos, ladrillo visto y ventanales industriales. Walkable score 98.',
    price: 3200,
    listingType: 'rent',
    listingStatus: 'active',
    propertyType: 'apartment',
    addressLine: '456 Elm Ave',
    city: 'Portland',
    state: 'OR',
    country: 'USA',
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 85,
    yearBuilt: 2010,
    publishedDaysAgo: 2,
    amenities: ['wifi', 'air_conditioning'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'marcus@luxe-estate.test',
    title: 'Highland Retreat',
    description:
      'Cabaña moderna en la montaña con vistas espectaculares al bosque. Ideal para escapadas o residencia secundaria.',
    price: 620000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'house',
    addressLine: '789 Mountain Rd',
    city: 'Bend',
    state: 'OR',
    country: 'USA',
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 98,
    parkingSpaces: 2,
    yearBuilt: 2018,
    publishedDaysAgo: 20,
    amenities: ['central_heating', 'garden', 'parking'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'david@luxe-estate.test',
    title: 'Sea View Penthouse',
    description: 'Penthouse con vista al océano. Balcón extenso y acceso directo a playa.',
    price: 4500,
    listingType: 'rent',
    listingStatus: 'active',
    propertyType: 'penthouse',
    addressLine: '321 Ocean Dr',
    city: 'Miami',
    state: 'FL',
    country: 'USA',
    bedrooms: 3,
    bathrooms: 3,
    areaSqm: 180,
    parkingSpaces: 2,
    yearBuilt: 2017,
    publishedDaysAgo: 6,
    amenities: ['pool', 'gym', 'air_conditioning', 'wifi'],
    timezone: 'America/New_York',
  },
  {
    ownerEmail: 'sarah.jenkins@luxe-estate.test',
    title: 'Modern Villa Palo Alto',
    description:
      'Villa de lujo en el corazón de Palo Alto. Smart home completo, gimnasio privado y wine cellar.',
    price: 1250000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'villa',
    addressLine: '1234 Serenity Lane',
    city: 'Palo Alto',
    state: 'CA',
    country: 'USA',
    bedrooms: 4,
    bathrooms: 3,
    areaSqm: 240,
    parkingSpaces: 2,
    yearBuilt: 2020,
    isPremium: true,
    isFeatured: true,
    publishedDaysAgo: 1,
    amenities: ['pool', 'smart_home', 'gym', 'wine_cellar', 'ev_charging', 'central_heating'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'marcus@luxe-estate.test',
    title: 'Modern Loft SoHo',
    description:
      'Loft moderno en SoHo. Diseño minimalista, mucha luz natural y a pasos de las mejores galerías.',
    price: 1895000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'apartment',
    addressLine: '88 Leonard St',
    city: 'New York',
    state: 'NY',
    country: 'USA',
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 117,
    yearBuilt: 2014,
    publishedDaysAgo: 10,
    amenities: ['gym', 'air_conditioning', 'wifi'],
    timezone: 'America/New_York',
  },
  {
    ownerEmail: 'david@luxe-estate.test',
    title: 'Forest Retreat',
    description:
      'Refugio en el bosque con paneles solares y arquitectura sostenible. Conectado pero apartado.',
    price: 3100000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'house',
    addressLine: '45 Pine Ridge',
    city: 'Portland',
    state: 'OR',
    country: 'USA',
    bedrooms: 5,
    bathrooms: 4,
    areaSqm: 418,
    parkingSpaces: 3,
    yearBuilt: 2022,
    isPremium: true,
    publishedDaysAgo: 8,
    amenities: ['garden', 'smart_home', 'ev_charging', 'central_heating'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'sarah@luxe-estate.test',
    title: 'The Nordic Villa',
    description:
      'Villa de estilo escandinavo con líneas limpias y mucha luz. Perfecta para amantes del diseño nórdico.',
    price: 1250000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'villa',
    addressLine: '12 Willow Creek Ln',
    city: 'Copenhagen',
    country: 'Denmark',
    bedrooms: 4,
    bathrooms: 3,
    areaSqm: 228,
    parkingSpaces: 2,
    yearBuilt: 2019,
    publishedDaysAgo: 15,
    amenities: ['garden', 'central_heating', 'smart_home'],
    timezone: 'Europe/Copenhagen',
  },
  {
    ownerEmail: 'sarah@luxe-estate.test',
    title: 'Sunset Apartments',
    description: 'Apartamento luminoso frente al mar. Acabados modernos y gimnasio en el edificio.',
    price: 850000,
    listingType: 'sale',
    listingStatus: 'pending',
    propertyType: 'apartment',
    addressLine: '88 Ocean Blvd',
    city: 'Miami',
    state: 'FL',
    country: 'USA',
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 102,
    yearBuilt: 2016,
    publishedDaysAgo: 30,
    amenities: ['pool', 'gym', 'wifi', 'air_conditioning'],
    timezone: 'America/New_York',
  },
  {
    ownerEmail: 'sarah@luxe-estate.test',
    title: 'Skyline Penthouse',
    description:
      'Penthouse de tres pisos con terraza panorámica. La vista más espectacular de Manhattan.',
    price: 4500000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'penthouse',
    addressLine: '440 W 57th St',
    city: 'New York',
    state: 'NY',
    country: 'USA',
    bedrooms: 3,
    bathrooms: 3.5,
    areaSqm: 260,
    parkingSpaces: 2,
    yearBuilt: 2018,
    isFeatured: true,
    isPremium: true,
    previousPrice: 4800000,
    publishedDaysAgo: 4,
    amenities: ['gym', 'smart_home', 'wine_cellar', 'air_conditioning'],
    timezone: 'America/New_York',
  },

  // === 37 nuevas properties para seed_more_properties (2026-05-27) ===
  // --- HOUSES (9 nuevas) ---
  {
    ownerEmail: 'david@luxe-estate.test',
    title: 'Craftsman Bungalow',
    description: 'Bungalow estilo craftsman restaurado. Pisos de madera originales y porch amplio.',
    price: 720000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'house',
    addressLine: '442 Birch Ave',
    city: 'Seattle',
    state: 'WA',
    country: 'USA',
    bedrooms: 3,
    bathrooms: 2,
    areaSqm: 145,
    parkingSpaces: 1,
    yearBuilt: 1925,
    publishedDaysAgo: 12,
    amenities: ['garden', 'parking', 'central_heating'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'marcus@luxe-estate.test',
    title: 'Coastal Family House',
    description:
      'Casa familiar a 5 min de la playa. Patio trasero con BBQ y jardín de bajo mantenimiento.',
    price: 1180000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'house',
    addressLine: '17 Seaview Rd',
    city: 'San Diego',
    state: 'CA',
    country: 'USA',
    bedrooms: 4,
    bathrooms: 3,
    areaSqm: 195,
    parkingSpaces: 2,
    yearBuilt: 2008,
    publishedDaysAgo: 18,
    amenities: ['garden', 'parking', 'air_conditioning', 'patio'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'sarah@luxe-estate.test',
    title: 'Brownstone Townhome',
    description: 'Brownstone de tres pisos en Brooklyn. Cocina renovada y patio privado.',
    price: 2450000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'house',
    addressLine: '231 Carroll St',
    city: 'New York',
    state: 'NY',
    country: 'USA',
    bedrooms: 4,
    bathrooms: 3.5,
    areaSqm: 220,
    parkingSpaces: 0,
    yearBuilt: 1905,
    publishedDaysAgo: 9,
    amenities: ['patio', 'central_heating'],
    timezone: 'America/New_York',
  },
  {
    ownerEmail: 'david@luxe-estate.test',
    title: 'Suburban Ranch',
    description:
      'Casa rancho de un solo piso. Ideal para familias con niños pequeños o adultos mayores.',
    price: 540000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'house',
    addressLine: '88 Maple Ln',
    city: 'Austin',
    state: 'TX',
    country: 'USA',
    bedrooms: 3,
    bathrooms: 2,
    areaSqm: 135,
    parkingSpaces: 2,
    yearBuilt: 1995,
    publishedDaysAgo: 22,
    amenities: ['garden', 'parking', 'air_conditioning'],
    timezone: 'America/Chicago',
  },
  {
    ownerEmail: 'michael.ross@luxe-estate.test',
    title: 'Mountain Chalet',
    description: 'Chalet de montaña con vista al valle. Chimenea de piedra y deck panorámico.',
    price: 1850000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'house',
    addressLine: '7 Snowmass Trail',
    city: 'Aspen',
    state: 'CO',
    country: 'USA',
    bedrooms: 4,
    bathrooms: 3,
    areaSqm: 240,
    parkingSpaces: 2,
    yearBuilt: 2012,
    publishedDaysAgo: 16,
    amenities: ['central_heating', 'parking'],
    timezone: 'America/Denver',
  },
  {
    ownerEmail: 'sarah.jenkins@luxe-estate.test',
    title: 'Mid-Century Modern',
    description: 'Joya mid-century preservada. Ventanales del piso al techo y patio interior.',
    price: 1650000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'house',
    addressLine: '522 Eichler Way',
    city: 'Palo Alto',
    state: 'CA',
    country: 'USA',
    bedrooms: 3,
    bathrooms: 2,
    areaSqm: 170,
    parkingSpaces: 2,
    yearBuilt: 1962,
    isFeatured: true,
    publishedDaysAgo: 6,
    amenities: ['patio', 'central_heating', 'smart_home'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'marcus@luxe-estate.test',
    title: 'Lakefront Cottage',
    description: 'Cabaña frente al lago con muelle privado. Perfecta para fines de semana.',
    price: 2800,
    listingType: 'rent',
    listingStatus: 'active',
    propertyType: 'house',
    addressLine: '4 Lakeside Dr',
    city: 'Bend',
    state: 'OR',
    country: 'USA',
    bedrooms: 2,
    bathrooms: 1,
    areaSqm: 90,
    parkingSpaces: 2,
    yearBuilt: 1988,
    publishedDaysAgo: 4,
    amenities: ['garden', 'parking', 'central_heating'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'david@luxe-estate.test',
    title: 'Family House with Pool',
    description: 'Casa familiar con piscina y jardín grande. Calle tranquila y buenas escuelas.',
    price: 980000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'house',
    addressLine: '63 Oakwood Pl',
    city: 'Portland',
    state: 'OR',
    country: 'USA',
    bedrooms: 4,
    bathrooms: 3,
    areaSqm: 215,
    parkingSpaces: 2,
    yearBuilt: 2005,
    publishedDaysAgo: 25,
    amenities: ['pool', 'garden', 'parking', 'central_heating'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'sarah@luxe-estate.test',
    title: 'Cape Cod Retreat',
    description: 'Cape Cod tradicional cerca de la playa. Mucho carácter y luz natural.',
    price: 4200,
    listingType: 'rent',
    listingStatus: 'active',
    propertyType: 'house',
    addressLine: '210 Beach Plum Ln',
    city: 'Boston',
    state: 'MA',
    country: 'USA',
    bedrooms: 3,
    bathrooms: 2,
    areaSqm: 160,
    parkingSpaces: 1,
    yearBuilt: 1970,
    publishedDaysAgo: 11,
    amenities: ['garden', 'central_heating'],
    timezone: 'America/New_York',
  },

  // --- APARTMENTS (8 nuevas) ---
  {
    ownerEmail: 'sarah@luxe-estate.test',
    title: 'Tribeca Studio',
    description: 'Studio en Tribeca con cocina abierta. Edificio con gym y rooftop.',
    price: 3400,
    listingType: 'rent',
    listingStatus: 'active',
    propertyType: 'apartment',
    addressLine: '15 Hudson St',
    city: 'New York',
    state: 'NY',
    country: 'USA',
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 45,
    yearBuilt: 2016,
    publishedDaysAgo: 5,
    amenities: ['gym', 'wifi', 'air_conditioning'],
    timezone: 'America/New_York',
  },
  {
    ownerEmail: 'marcus@luxe-estate.test',
    title: 'Yaletown Two-Bedroom',
    description: 'Apartamento de 2 dorm en Yaletown. Cerca de transit y vista al sea wall.',
    price: 2900,
    listingType: 'rent',
    listingStatus: 'active',
    propertyType: 'apartment',
    addressLine: '1188 Pacific Blvd',
    city: 'Vancouver',
    state: 'BC',
    country: 'Canada',
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 95,
    parkingSpaces: 1,
    yearBuilt: 2014,
    publishedDaysAgo: 7,
    amenities: ['gym', 'wifi', 'parking'],
    timezone: 'America/Vancouver',
  },
  {
    ownerEmail: 'sarah@luxe-estate.test',
    title: 'Capitol Hill Condo',
    description: 'Condo luminoso en Capitol Hill. A pasos de cafés y bookstores.',
    price: 685000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'apartment',
    addressLine: '1432 E Pine St',
    city: 'Seattle',
    state: 'WA',
    country: 'USA',
    bedrooms: 2,
    bathrooms: 1,
    areaSqm: 78,
    parkingSpaces: 1,
    yearBuilt: 2013,
    publishedDaysAgo: 14,
    amenities: ['wifi', 'central_heating'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'sarah.jenkins@luxe-estate.test',
    title: 'Modern South Beach Condo',
    description: 'Condo a una cuadra de Ocean Drive. Pool en el edificio y vistas al Atlántico.',
    price: 1290000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'apartment',
    addressLine: '700 Collins Ave',
    city: 'Miami',
    state: 'FL',
    country: 'USA',
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 110,
    parkingSpaces: 1,
    yearBuilt: 2017,
    publishedDaysAgo: 9,
    amenities: ['pool', 'gym', 'air_conditioning', 'wifi'],
    timezone: 'America/New_York',
  },
  {
    ownerEmail: 'sarah@luxe-estate.test',
    title: 'Greenwich Village Walk-up',
    description: 'Walk-up clásico en el Village. Techos altos y mucho carácter.',
    price: 3850,
    listingType: 'rent',
    listingStatus: 'active',
    propertyType: 'apartment',
    addressLine: '88 Bleecker St',
    city: 'New York',
    state: 'NY',
    country: 'USA',
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 60,
    yearBuilt: 1920,
    publishedDaysAgo: 19,
    amenities: ['wifi'],
    timezone: 'America/New_York',
  },
  {
    ownerEmail: 'marcus@luxe-estate.test',
    title: 'Coal Harbour Two-Bed',
    description: 'Dos dormitorios en Coal Harbour. Vista al puerto y montañas.',
    price: 1450000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'apartment',
    addressLine: '1281 W Cordova St',
    city: 'Vancouver',
    state: 'BC',
    country: 'Canada',
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 105,
    parkingSpaces: 1,
    yearBuilt: 2018,
    publishedDaysAgo: 13,
    amenities: ['gym', 'parking', 'air_conditioning'],
    timezone: 'America/Vancouver',
  },
  {
    ownerEmail: 'david@luxe-estate.test',
    title: 'Pearl District Loft',
    description: 'Loft en Pearl District. Ladrillo visto y ventanales industriales.',
    price: 2650,
    listingType: 'rent',
    listingStatus: 'active',
    propertyType: 'apartment',
    addressLine: '610 NW 13th Ave',
    city: 'Portland',
    state: 'OR',
    country: 'USA',
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 75,
    yearBuilt: 2009,
    publishedDaysAgo: 8,
    amenities: ['wifi', 'air_conditioning'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'sarah.jenkins@luxe-estate.test',
    title: 'Mission District One-Bed',
    description: 'Uno-dorm en Mission. Cocina renovada y patio compartido.',
    price: 3100,
    listingType: 'rent',
    listingStatus: 'active',
    propertyType: 'apartment',
    addressLine: '2900 24th St',
    city: 'San Francisco',
    state: 'CA',
    country: 'USA',
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 55,
    yearBuilt: 1925,
    publishedDaysAgo: 6,
    amenities: ['wifi', 'patio'],
    timezone: 'America/Los_Angeles',
  },

  // --- VILLAS (7 nuevas) ---
  {
    ownerEmail: 'sarah.jenkins@luxe-estate.test',
    title: 'Hillside Villa with View',
    description: 'Villa en colina con vista panorámica a la bahía. Smart home completo.',
    price: 4750000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'villa',
    addressLine: '900 Skyline Dr',
    city: 'San Francisco',
    state: 'CA',
    country: 'USA',
    bedrooms: 5,
    bathrooms: 4.5,
    areaSqm: 380,
    parkingSpaces: 3,
    yearBuilt: 2020,
    isPremium: true,
    isFeatured: true,
    publishedDaysAgo: 2,
    amenities: ['pool', 'gym', 'smart_home', 'wine_cellar', 'ev_charging', 'garden'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'michael.ross@luxe-estate.test',
    title: 'Aspen Mountain Villa',
    description: 'Villa de lujo en Aspen. Acceso ski-in/ski-out y hot tub privado.',
    price: 8900000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'villa',
    addressLine: '12 Powderhorn Pl',
    city: 'Aspen',
    state: 'CO',
    country: 'USA',
    bedrooms: 6,
    bathrooms: 5,
    areaSqm: 520,
    parkingSpaces: 4,
    yearBuilt: 2019,
    isPremium: true,
    isFeatured: true,
    publishedDaysAgo: 17,
    amenities: ['gym', 'wine_cellar', 'smart_home', 'central_heating', 'ev_charging'],
    timezone: 'America/Denver',
  },
  {
    ownerEmail: 'sarah@luxe-estate.test',
    title: 'Mediterranean Villa',
    description:
      'Villa estilo mediterráneo con patio interior y olivos. Acabados en piedra natural.',
    price: 3650000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'villa',
    addressLine: '88 Olivar Way',
    city: 'San Diego',
    state: 'CA',
    country: 'USA',
    bedrooms: 5,
    bathrooms: 4,
    areaSqm: 410,
    parkingSpaces: 3,
    yearBuilt: 2015,
    publishedDaysAgo: 21,
    amenities: ['pool', 'garden', 'patio', 'wine_cellar'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'sarah.jenkins@luxe-estate.test',
    title: 'Modernist Glass Villa',
    description:
      'Villa modernista con paredes de vidrio orientadas al sur. Premiada por su arquitectura.',
    price: 6200000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'villa',
    addressLine: '34 Architect Dr',
    city: 'Palo Alto',
    state: 'CA',
    country: 'USA',
    bedrooms: 4,
    bathrooms: 4,
    areaSqm: 390,
    parkingSpaces: 3,
    yearBuilt: 2022,
    isFeatured: true,
    publishedDaysAgo: 10,
    amenities: ['pool', 'smart_home', 'gym', 'ev_charging', 'wine_cellar'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'marcus@luxe-estate.test',
    title: 'Whistler Villa Retreat',
    description: 'Villa en Whistler con sauna y deck con vista al bosque.',
    price: 12500,
    listingType: 'rent',
    listingStatus: 'active',
    propertyType: 'villa',
    addressLine: '4321 Sunridge Lane',
    city: 'Whistler',
    state: 'BC',
    country: 'Canada',
    bedrooms: 5,
    bathrooms: 4,
    areaSqm: 360,
    parkingSpaces: 3,
    yearBuilt: 2017,
    publishedDaysAgo: 5,
    amenities: ['central_heating', 'smart_home', 'parking', 'garden'],
    timezone: 'America/Vancouver',
  },
  {
    ownerEmail: 'michael.ross@luxe-estate.test',
    title: 'Desert Modern Villa',
    description: 'Villa en el desierto con piscina infinita y vistas a las montañas.',
    price: 2950000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'villa',
    addressLine: '777 Sonoran Trail',
    city: 'Scottsdale',
    state: 'AZ',
    country: 'USA',
    bedrooms: 4,
    bathrooms: 4,
    areaSqm: 320,
    parkingSpaces: 3,
    yearBuilt: 2018,
    publishedDaysAgo: 28,
    amenities: ['pool', 'smart_home', 'air_conditioning', 'patio'],
    timezone: 'America/Phoenix',
  },
  {
    ownerEmail: 'sarah@luxe-estate.test',
    title: 'Coastal Italian Villa',
    description:
      'Villa al estilo italiano con vista al Mediterráneo. Pérgola con uvas y horno de leña.',
    price: 4100000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'villa',
    addressLine: '12 Via del Mare',
    city: 'Miami',
    state: 'FL',
    country: 'USA',
    bedrooms: 5,
    bathrooms: 4.5,
    areaSqm: 430,
    parkingSpaces: 2,
    yearBuilt: 2010,
    publishedDaysAgo: 33,
    amenities: ['pool', 'garden', 'patio', 'wine_cellar', 'air_conditioning'],
    timezone: 'America/New_York',
  },

  // --- PENTHOUSES (7 nuevas) ---
  {
    ownerEmail: 'sarah@luxe-estate.test',
    title: 'Midtown Sky Penthouse',
    description: 'Penthouse en Midtown con doble altura y terraza wrap-around.',
    price: 6800000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'penthouse',
    addressLine: '500 5th Ave',
    city: 'New York',
    state: 'NY',
    country: 'USA',
    bedrooms: 4,
    bathrooms: 4,
    areaSqm: 320,
    parkingSpaces: 2,
    yearBuilt: 2019,
    isPremium: true,
    publishedDaysAgo: 12,
    amenities: ['gym', 'smart_home', 'wine_cellar', 'air_conditioning'],
    timezone: 'America/New_York',
  },
  {
    ownerEmail: 'marcus@luxe-estate.test',
    title: 'Harbor View Penthouse',
    description: 'Penthouse con vista al puerto y Stanley Park. Concierge 24h.',
    price: 5200000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'penthouse',
    addressLine: '188 W Pender St',
    city: 'Vancouver',
    state: 'BC',
    country: 'Canada',
    bedrooms: 3,
    bathrooms: 3,
    areaSqm: 240,
    parkingSpaces: 2,
    yearBuilt: 2020,
    publishedDaysAgo: 7,
    amenities: ['gym', 'smart_home', 'wine_cellar'],
    timezone: 'America/Vancouver',
  },
  {
    ownerEmail: 'sarah.jenkins@luxe-estate.test',
    title: 'Marina Bay Penthouse',
    description: 'Penthouse frente a la marina. Acceso a yates privados.',
    price: 7500,
    listingType: 'rent',
    listingStatus: 'active',
    propertyType: 'penthouse',
    addressLine: '1500 Bayshore Dr',
    city: 'Miami',
    state: 'FL',
    country: 'USA',
    bedrooms: 3,
    bathrooms: 3,
    areaSqm: 220,
    parkingSpaces: 2,
    yearBuilt: 2018,
    publishedDaysAgo: 4,
    amenities: ['pool', 'gym', 'air_conditioning', 'wifi'],
    timezone: 'America/New_York',
  },
  {
    ownerEmail: 'sarah@luxe-estate.test',
    title: 'Hudson Yards Penthouse',
    description: 'Penthouse en Hudson Yards. Vista al río Hudson y skyline de Manhattan.',
    price: 9800000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'penthouse',
    addressLine: '15 Hudson Yards',
    city: 'New York',
    state: 'NY',
    country: 'USA',
    bedrooms: 4,
    bathrooms: 4.5,
    areaSqm: 380,
    parkingSpaces: 2,
    yearBuilt: 2021,
    isPremium: true,
    isFeatured: true,
    publishedDaysAgo: 1,
    amenities: ['gym', 'smart_home', 'wine_cellar', 'ev_charging', 'air_conditioning'],
    timezone: 'America/New_York',
  },
  {
    ownerEmail: 'sarah.jenkins@luxe-estate.test',
    title: 'SoMa Penthouse Loft',
    description: 'Penthouse-loft en SoMa con techos de 4m y terraza privada.',
    price: 3950000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'penthouse',
    addressLine: '999 Brannan St',
    city: 'San Francisco',
    state: 'CA',
    country: 'USA',
    bedrooms: 2,
    bathrooms: 2.5,
    areaSqm: 200,
    parkingSpaces: 2,
    yearBuilt: 2016,
    publishedDaysAgo: 11,
    amenities: ['gym', 'smart_home', 'air_conditioning'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'marcus@luxe-estate.test',
    title: 'Granville Island Penthouse',
    description: 'Penthouse con vista a Granville Island. Mucha luz y rooftop deck.',
    price: 6500,
    listingType: 'rent',
    listingStatus: 'active',
    propertyType: 'penthouse',
    addressLine: '1455 W 2nd Ave',
    city: 'Vancouver',
    state: 'BC',
    country: 'Canada',
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 175,
    parkingSpaces: 1,
    yearBuilt: 2019,
    publishedDaysAgo: 15,
    amenities: ['gym', 'wifi', 'air_conditioning'],
    timezone: 'America/Vancouver',
  },
  {
    ownerEmail: 'michael.ross@luxe-estate.test',
    title: 'Aspen Ridge Penthouse',
    description: 'Penthouse en Aspen con vista a Ajax Mountain. Acceso a spa y ski concierge.',
    price: 11200,
    listingType: 'rent',
    listingStatus: 'active',
    propertyType: 'penthouse',
    addressLine: '301 Hyman Ave',
    city: 'Aspen',
    state: 'CO',
    country: 'USA',
    bedrooms: 3,
    bathrooms: 3,
    areaSqm: 230,
    parkingSpaces: 2,
    yearBuilt: 2020,
    publishedDaysAgo: 23,
    amenities: ['gym', 'central_heating', 'smart_home', 'wine_cellar'],
    timezone: 'America/Denver',
  },

  // --- CONDO (3 nuevas, variedad extra) ---
  {
    ownerEmail: 'sarah@luxe-estate.test',
    title: 'Battery Park Condo',
    description: 'Condo en Battery Park con vista al río. Edificio con spa y concierge.',
    price: 2150000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'condo',
    addressLine: '200 Rector Pl',
    city: 'New York',
    state: 'NY',
    country: 'USA',
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 115,
    parkingSpaces: 1,
    yearBuilt: 2015,
    publishedDaysAgo: 14,
    amenities: ['gym', 'air_conditioning', 'wifi'],
    timezone: 'America/New_York',
  },
  {
    ownerEmail: 'sarah.jenkins@luxe-estate.test',
    title: 'Russian Hill Condo',
    description: 'Condo en Russian Hill con vista al Bay Bridge. Garage incluido.',
    price: 1750000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'condo',
    addressLine: '1234 Hyde St',
    city: 'San Francisco',
    state: 'CA',
    country: 'USA',
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 100,
    parkingSpaces: 1,
    yearBuilt: 2010,
    publishedDaysAgo: 20,
    amenities: ['parking', 'central_heating'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'marcus@luxe-estate.test',
    title: 'Kitsilano Condo',
    description: 'Condo en Kitsilano a 3 min de la playa. Cocina renovada.',
    price: 3200,
    listingType: 'rent',
    listingStatus: 'active',
    propertyType: 'condo',
    addressLine: '2055 W 4th Ave',
    city: 'Vancouver',
    state: 'BC',
    country: 'Canada',
    bedrooms: 2,
    bathrooms: 1,
    areaSqm: 85,
    parkingSpaces: 1,
    yearBuilt: 2008,
    publishedDaysAgo: 9,
    amenities: ['parking', 'wifi'],
    timezone: 'America/Vancouver',
  },

  // --- TOWNHOUSE (3 nuevas, variedad extra) ---
  {
    ownerEmail: 'david@luxe-estate.test',
    title: 'Pearl Townhome',
    description: 'Townhome de 3 pisos en Pearl District. Roof deck con vista.',
    price: 895000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'townhouse',
    addressLine: '925 NW Flanders St',
    city: 'Portland',
    state: 'OR',
    country: 'USA',
    bedrooms: 3,
    bathrooms: 2.5,
    areaSqm: 175,
    parkingSpaces: 1,
    yearBuilt: 2017,
    publishedDaysAgo: 6,
    amenities: ['parking', 'patio', 'central_heating'],
    timezone: 'America/Los_Angeles',
  },
  {
    ownerEmail: 'sarah@luxe-estate.test',
    title: 'Beacon Hill Townhouse',
    description: 'Townhouse histórico en Beacon Hill. 4 niveles y patio inglés.',
    price: 3850000,
    listingType: 'sale',
    listingStatus: 'active',
    propertyType: 'townhouse',
    addressLine: '42 Mt Vernon St',
    city: 'Boston',
    state: 'MA',
    country: 'USA',
    bedrooms: 4,
    bathrooms: 3.5,
    areaSqm: 280,
    parkingSpaces: 0,
    yearBuilt: 1850,
    publishedDaysAgo: 16,
    amenities: ['patio', 'central_heating', 'wine_cellar'],
    timezone: 'America/New_York',
  },
  {
    ownerEmail: 'sarah.jenkins@luxe-estate.test',
    title: 'Noe Valley Townhome',
    description: 'Townhome en Noe Valley con garage y deck soleado.',
    price: 5500,
    listingType: 'rent',
    listingStatus: 'active',
    propertyType: 'townhouse',
    addressLine: '321 Sanchez St',
    city: 'San Francisco',
    state: 'CA',
    country: 'USA',
    bedrooms: 3,
    bathrooms: 2.5,
    areaSqm: 150,
    parkingSpaces: 1,
    yearBuilt: 2005,
    publishedDaysAgo: 8,
    amenities: ['parking', 'patio', 'central_heating'],
    timezone: 'America/Los_Angeles',
  },
];

async function findUserByEmail(email: string): Promise<string | null> {
  // listUsers no tiene filtro por email; paginamos hasta encontrarlo.
  let page = 1;
  const perPage = 100;
  while (page < 10) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
  return null;
}

async function upsertUser(seed: SeedUser): Promise<string> {
  let userId = await findUserByEmail(seed.email);

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: seed.email,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: seed.fullName },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`  ✓ creado ${seed.email}`);
  } else {
    console.log(`  → ya existe ${seed.email}`);
  }

  // Upsert del profile (el trigger ya lo crea; aquí actualizamos los campos
  // del seed como role, city, bio que el trigger no sabe).
  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email: seed.email,
      full_name: seed.fullName,
      role: seed.role,
      city: seed.city ?? null,
      bio: seed.bio ?? null,
    },
    { onConflict: 'id' },
  );
  if (profileError) throw profileError;

  return userId;
}

// Pool de IDs estables de Unsplash para placeholders del seed. Las primeras
// imágenes de cada property se eligen con afinidad temática (ver
// EXTERIOR_BY_TYPE); las restantes rotan por el pool completo.
// Para agregar/reemplazar IDs ver scripts/seed-notes.md.
const UNSPLASH_PHOTO_IDS = [
  'photo-1600596542815-ffad4c1539a9',
  'photo-1613490493576-7fde63acd811',
  'photo-1600585154340-be6161a56a0c',
  'photo-1512917774080-9991f1c4c750',
  'photo-1564013799919-ab600027ffc6',
  'photo-1502672260266-1c1ef2d93688',
  'photo-1600607687939-ce8a6c25118c',
  'photo-1564540583246-934409427776',
  'photo-1600585154526-990dced4db0d',
  'photo-1505691938895-1758d7feb511',
  'photo-1493809842364-78817add7ffb',
  'photo-1554995207-c18c203602cb',
  'photo-1560448204-e02f11c3d0e2',
  'photo-1502005229762-cf1b2da7c5d6',
  'photo-1583608205776-bfd35f0d9f83',
  'photo-1493663284031-b7e3aefcae8e',
  'photo-1568605114967-8130f3a36994',
  'photo-1570129477492-45c003edd2be',
  'photo-1582268611958-ebfd161ef9cf',
  'photo-1576941089067-2de3c901e126',
  'photo-1615873968403-89e068629265',
  'photo-1600210492486-724fe5c67fb0',
  'photo-1600210491892-03d54c0aaf87',
  'photo-1600573472556-e636c2acda88',
  'photo-1556228720-195a672e8a03',
  'photo-1605276374104-dee2a0ed3cd6',
  'photo-1572120360610-d971b9d7767c',
  'photo-1484154218962-a197022b5858',
  'photo-1522708323590-d24dbb6b0267',
  'photo-1556909114-f6e7ad7d3136',
  'photo-1540518614846-7eded433c457',
  'photo-1567496898669-ee935f5f647a',
  'photo-1542314831-068cd1dbfeeb',
  'photo-1545324418-cc1a3fa10c00',
  'photo-1512918728675-ed5a9ecdebfd',
  'photo-1505843513577-22bb7d21e455',
  'photo-1616594039964-ae9021a400a0',
  'photo-1616486338812-3dadae4b4ace',
  'photo-1616137466211-f939a420be84',
  'photo-1571508601891-ca5e7a713859',
  'photo-1571055107559-3e67626fa8be',
  'photo-1480074568708-e7b720bb3f09',
  'photo-1518780664697-55e3ad937233',
  'photo-1469796466635-455ede028aca',
  'photo-1449844908441-8829872d2607',
  'photo-1502005097973-6a7082348e28',
  'photo-1523217582562-09d0def993a6',
  'photo-1568084680786-a84f91d1153c',
  'photo-1551776235-dde6d482980b',
];

// Pool temático por tipo de property: la primera imagen (is_main) se elige
// de aquí para que el "hero" coincida visualmente con el tipo. condo y
// townhouse hacen fallback al pool general (ver pickImagesFor).
const EXTERIOR_BY_TYPE: Partial<Record<Database['public']['Enums']['property_type'], string[]>> = {
  house: [
    'photo-1600596542815-ffad4c1539a9',
    'photo-1512917774080-9991f1c4c750',
    'photo-1564013799919-ab600027ffc6',
    'photo-1502005229762-cf1b2da7c5d6',
    'photo-1568605114967-8130f3a36994',
    'photo-1493663284031-b7e3aefcae8e',
    'photo-1571055107559-3e67626fa8be',
    'photo-1469796466635-455ede028aca',
    'photo-1449844908441-8829872d2607',
    'photo-1502005097973-6a7082348e28',
    'photo-1542314831-068cd1dbfeeb',
  ],
  villa: [
    'photo-1613490493576-7fde63acd811',
    'photo-1600585154340-be6161a56a0c',
    'photo-1570129477492-45c003edd2be',
    'photo-1512918728675-ed5a9ecdebfd',
    'photo-1480074568708-e7b720bb3f09',
    'photo-1605276374104-dee2a0ed3cd6',
    'photo-1567496898669-ee935f5f647a',
    'photo-1540518614846-7eded433c457',
  ],
  apartment: [
    'photo-1505691938895-1758d7feb511',
    'photo-1583608205776-bfd35f0d9f83',
    'photo-1615873968403-89e068629265',
    'photo-1572120360610-d971b9d7767c',
    'photo-1523217582562-09d0def993a6',
    'photo-1493809842364-78817add7ffb',
    'photo-1551776235-dde6d482980b',
  ],
  penthouse: [
    'photo-1502672260266-1c1ef2d93688',
    'photo-1600210492486-724fe5c67fb0',
    'photo-1545324418-cc1a3fa10c00',
    'photo-1518780664697-55e3ad937233',
    'photo-1560448204-e02f11c3d0e2',
  ],
};

const IMAGES_PER_PROPERTY = 6;

type ImagePlan = { photoId: string; isMain: boolean; position: number };

function pickImagesFor(
  propertyType: Database['public']['Enums']['property_type'],
  propertyIndex: number,
): ImagePlan[] {
  const heroPool = EXTERIOR_BY_TYPE[propertyType] ?? UNSPLASH_PHOTO_IDS;
  const heroId = heroPool[propertyIndex % heroPool.length];

  const rest: string[] = [];
  for (let i = 0; i < IMAGES_PER_PROPERTY - 1; i++) {
    let id =
      UNSPLASH_PHOTO_IDS[(propertyIndex * IMAGES_PER_PROPERTY + i + 1) % UNSPLASH_PHOTO_IDS.length];
    // Evitar duplicar el hero en la misma property (con jump de 7 para variedad).
    if (id === heroId) {
      id =
        UNSPLASH_PHOTO_IDS[
          (propertyIndex * IMAGES_PER_PROPERTY + i + 1 + 7) % UNSPLASH_PHOTO_IDS.length
        ];
    }
    rest.push(id);
  }

  return [
    { photoId: heroId, isMain: true, position: 0 },
    ...rest.map((id, idx) => ({ photoId: id, isMain: false, position: idx + 1 })),
  ];
}

function buildUnsplashUrl(photoId: string): string {
  return `https://images.unsplash.com/${photoId}?w=1600&q=80&auto=format&fit=crop`;
}

async function upsertProperty(
  seed: SeedProperty,
  ownerId: string,
  propertyIndex: number,
): Promise<string> {
  // Idempotencia por (owner, title): si ya existe, lo reusamos.
  const { data: existing, error: existingError } = await supabase
    .from('properties')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('title', seed.title)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    console.log(`  → ya existe property "${seed.title}"`);
    await seedPropertyImages(existing.id, seed.title, seed.propertyType, propertyIndex);
    return existing.id;
  }

  const publishedAt = new Date();
  publishedAt.setDate(publishedAt.getDate() - seed.publishedDaysAgo);

  const { data, error } = await supabase
    .from('properties')
    .insert({
      owner_id: ownerId,
      title: seed.title,
      description: seed.description,
      price: seed.price,
      listing_type: seed.listingType,
      listing_status: seed.listingStatus,
      property_type: seed.propertyType,
      address_line: seed.addressLine,
      city: seed.city,
      state: seed.state ?? null,
      country: seed.country ?? null,
      bedrooms: seed.bedrooms,
      bathrooms: seed.bathrooms,
      area_sqm: seed.areaSqm,
      parking_spaces: seed.parkingSpaces ?? 0,
      year_built: seed.yearBuilt ?? null,
      is_featured: seed.isFeatured ?? false,
      is_premium: seed.isPremium ?? false,
      previous_price: seed.previousPrice ?? null,
      published_at: publishedAt.toISOString(),
      timezone: seed.timezone ?? 'America/Mexico_City',
    })
    .select('id')
    .single();
  if (error) throw error;

  console.log(`  ✓ creada property "${seed.title}"`);

  // Insertar amenities.
  if (seed.amenities.length > 0) {
    const { error: amenError } = await supabase
      .from('property_amenities')
      .insert(seed.amenities.map((a) => ({ property_id: data.id, amenity: a })));
    if (amenError) throw amenError;
  }

  await seedPropertyImages(data.id, seed.title, seed.propertyType, propertyIndex);

  return data.id;
}

// Los placeholders del seed usan URLs absolutas en `storage_path`; las
// imágenes reales subidas por agentes serán paths relativos del bucket
// `property-images` (ver src/lib/images/get-image-url.ts).
//
// Idempotencia: completa hasta IMAGES_PER_PROPERTY filas. Re-run sin
// cambios → skip. Cambiar IMAGES_PER_PROPERTY a un valor mayor → inserta
// solo las faltantes, sin tocar las existentes ni corromper el invariante
// "exactamente una is_main por property" (ver scripts/seed-notes.md §
// Sanity check).
async function seedPropertyImages(
  propertyId: string,
  propertyTitle: string,
  propertyType: Database['public']['Enums']['property_type'],
  propertyIndex: number,
): Promise<void> {
  const { data: existingImages, error } = await supabase
    .from('property_images')
    .select('position, is_main')
    .eq('property_id', propertyId)
    .order('position', { ascending: true });
  if (error) throw error;

  const existingCount = existingImages?.length ?? 0;
  if (existingCount >= IMAGES_PER_PROPERTY) {
    console.log(`    → ya hay ${existingCount} imágenes para "${propertyTitle}"`);
    return;
  }

  const hasMain = (existingImages ?? []).some((img) => img.is_main);
  const startPosition = existingCount;

  // Plan completo de IMAGES_PER_PROPERTY imágenes; descartamos las primeras
  // `existingCount` y solo insertamos el resto, manteniendo posiciones
  // consecutivas a partir de startPosition.
  const plan = pickImagesFor(propertyType, propertyIndex);
  const slice = plan.slice(existingCount);

  const rows = slice.map((p, i) => ({
    property_id: propertyId,
    storage_path: buildUnsplashUrl(p.photoId),
    // Solo marcamos is_main si NO había ya una main y esta es la primera nueva.
    is_main: !hasMain && i === 0,
    position: startPosition + i,
    alt_text: `${propertyTitle} — foto ${startPosition + i + 1}`,
  }));

  const { error: imgError } = await supabase.from('property_images').insert(rows);
  if (imgError) throw imgError;
  console.log(
    `    ✓ ${rows.length} imágenes nuevas (total ${existingCount + rows.length}) para "${propertyTitle}"`,
  );
}

async function seedFavorites(
  userIdByEmail: Map<string, string>,
  propertyIdByTitle: Map<string, string>,
) {
  const elenaId = userIdByEmail.get('elena@luxe-estate.test')!;
  const favorites = [
    'The Glass Pavilion',
    'Modern Villa Palo Alto',
    'Skyline Penthouse',
    'The Nordic Villa',
  ];

  for (const title of favorites) {
    const propertyId = propertyIdByTitle.get(title);
    if (!propertyId) continue;
    const { error } = await supabase
      .from('favorites')
      .upsert({ user_id: elenaId, property_id: propertyId }, { onConflict: 'user_id,property_id' });
    if (error) throw error;
  }
  console.log(`  ✓ ${favorites.length} favoritos de elena`);
}

async function seedVisits(
  userIdByEmail: Map<string, string>,
  propertyIdByTitle: Map<string, string>,
) {
  const elenaId = userIdByEmail.get('elena@luxe-estate.test')!;

  type VisitSeed = {
    propertyTitle: string;
    agentEmail: string;
    daysFromNow: number;
    hour: number;
    minute: number;
    status: Database['public']['Enums']['visit_status'];
    message?: string;
  };

  const visits: VisitSeed[] = [
    {
      propertyTitle: 'Skyline Penthouse',
      agentEmail: 'sarah@luxe-estate.test',
      daysFromNow: 3,
      hour: 14,
      minute: 0,
      status: 'confirmed',
      message: 'Me interesa mucho la terraza, ¿podemos verla con luz natural?',
    },
    {
      propertyTitle: 'Forest Retreat',
      agentEmail: 'david@luxe-estate.test',
      daysFromNow: 7,
      hour: 10,
      minute: 30,
      status: 'pending',
    },
  ];

  for (const v of visits) {
    const propertyId = propertyIdByTitle.get(v.propertyTitle);
    const agentId = userIdByEmail.get(v.agentEmail);
    if (!propertyId || !agentId) continue;

    const { data: existing } = await supabase
      .from('visits')
      .select('id')
      .eq('user_id', elenaId)
      .eq('property_id', propertyId)
      .maybeSingle();
    if (existing) {
      console.log(`  → ya existe visita a "${v.propertyTitle}"`);
      continue;
    }

    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + v.daysFromNow);
    scheduledAt.setHours(v.hour, v.minute, 0, 0);

    const { error } = await supabase.from('visits').insert({
      property_id: propertyId,
      user_id: elenaId,
      agent_id: agentId,
      scheduled_at: scheduledAt.toISOString(),
      status: v.status,
      message: v.message ?? null,
    });
    if (error) throw error;
    console.log(`  ✓ visita a "${v.propertyTitle}" (${v.status})`);
  }
}

async function seedConversation(
  userIdByEmail: Map<string, string>,
  propertyIdByTitle: Map<string, string>,
) {
  const elenaId = userIdByEmail.get('elena@luxe-estate.test')!;
  const sarahJenkinsId = userIdByEmail.get('sarah.jenkins@luxe-estate.test')!;
  const propertyId = propertyIdByTitle.get('Modern Villa Palo Alto')!;

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('property_id', propertyId)
    .eq('user_id', elenaId)
    .eq('agent_id', sarahJenkinsId)
    .maybeSingle();

  let conversationId: string;
  if (existing) {
    conversationId = existing.id;
    console.log(`  → ya existe conversación`);
  } else {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        property_id: propertyId,
        user_id: elenaId,
        agent_id: sarahJenkinsId,
      })
      .select('id')
      .single();
    if (error) throw error;
    conversationId = data.id;
    console.log(`  ✓ conversación creada`);
  }

  // Mensajes (idempotencia: si ya hay >= 3, no insertamos más).
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId);

  if ((count ?? 0) >= 3) {
    console.log(`  → ya hay ${count} mensajes`);
    return;
  }

  const messages = [
    {
      sender: elenaId,
      body: '¡Hola Sarah! Me encanta la villa, ¿está disponible para visita la próxima semana?',
    },
    {
      sender: sarahJenkinsId,
      body: '¡Hola Elena! Claro, tengo disponibilidad el martes y jueves por la tarde. ¿Cuál prefieres?',
    },
    { sender: elenaId, body: 'El jueves a las 14:00 me viene perfecto. ¿Puedes confirmarme?' },
  ];

  for (const m of messages) {
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: m.sender,
      body: m.body,
    });
    if (error) throw error;
  }
  console.log(`  ✓ ${messages.length} mensajes`);
}

async function seedNotifications(
  userIdByEmail: Map<string, string>,
  propertyIdByTitle: Map<string, string>,
) {
  const elenaId = userIdByEmail.get('elena@luxe-estate.test')!;

  // Idempotencia: si elena ya tiene notificaciones, no recreamos.
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', elenaId);
  if ((count ?? 0) >= 3) {
    console.log(`  → ya hay ${count} notificaciones para elena`);
    return;
  }

  const skylineId = propertyIdByTitle.get('Skyline Penthouse');

  const notifications: Array<{
    type: Database['public']['Enums']['notification_type'];
    title: string;
    body: string;
    property_id?: string;
  }> = [
    {
      type: 'visit_reminder',
      title: 'Recordatorio de visita',
      body: 'Tu visita al Skyline Penthouse es en 3 días.',
      property_id: skylineId,
    },
    {
      type: 'price_drop',
      title: 'Precio reducido en una propiedad guardada',
      body: 'Skyline Penthouse bajó $300,000.',
      property_id: skylineId,
    },
    {
      type: 'new_message',
      title: 'Nuevo mensaje de Sarah Jenkins',
      body: 'Sarah Jenkins respondió tu consulta sobre Modern Villa Palo Alto.',
    },
  ];

  for (const n of notifications) {
    const { error } = await supabase.from('notifications').insert({
      recipient_id: elenaId,
      type: n.type,
      title: n.title,
      body: n.body,
      property_id: n.property_id ?? null,
    });
    if (error) throw error;
  }
  console.log(`  ✓ ${notifications.length} notificaciones para elena`);
}

async function main() {
  console.log('🌱 Seed de Luxe Estate\n');

  console.log('▶ Users:');
  const userIdByEmail = new Map<string, string>();
  for (const u of USERS) {
    const id = await upsertUser(u);
    userIdByEmail.set(u.email, id);
  }

  console.log('\n▶ Properties:');
  const propertyIdByTitle = new Map<string, string>();
  for (const [index, p] of PROPERTIES.entries()) {
    const ownerId = userIdByEmail.get(p.ownerEmail);
    if (!ownerId) {
      console.warn(`  ⚠ owner ${p.ownerEmail} no encontrado, salto "${p.title}"`);
      continue;
    }
    const id = await upsertProperty(p, ownerId, index);
    propertyIdByTitle.set(p.title, id);
  }

  console.log('\n▶ Favoritos:');
  await seedFavorites(userIdByEmail, propertyIdByTitle);

  console.log('\n▶ Visitas:');
  await seedVisits(userIdByEmail, propertyIdByTitle);

  console.log('\n▶ Conversación:');
  await seedConversation(userIdByEmail, propertyIdByTitle);

  console.log('\n▶ Notificaciones:');
  await seedNotifications(userIdByEmail, propertyIdByTitle);

  console.log('\n✅ Seed completado.\n');
  console.log(`Password de todos los users seed: ${SEED_PASSWORD}`);
}

main().catch((err) => {
  console.error('❌ Seed falló:', err);
  process.exit(1);
});
