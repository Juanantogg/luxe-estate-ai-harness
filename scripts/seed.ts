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

// Pool de IDs estables de Unsplash para placeholders del seed. Cada property
// toma 3 fotos consecutivas (con wrap) para que la galería tenga variedad.
const UNSPLASH_PHOTO_IDS = [
  'photo-1600596542815-ffad4c1539a9',
  'photo-1613490493576-7fde63acd811',
  'photo-1600585154340-be6161a56a0c',
  'photo-1512917774080-9991f1c4c750',
  'photo-1564013799919-ab600027ffc6',
  'photo-1502672260266-1c1ef2d93688',
  'photo-1600607687939-ce8a6c25118c',
  'photo-1600566753190-17f0baa2a6c8',
  'photo-1600585154526-990dced4db0d',
];

const IMAGES_PER_PROPERTY = 3;

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
    await seedPropertyImages(existing.id, seed.title, propertyIndex);
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

  await seedPropertyImages(data.id, seed.title, propertyIndex);

  return data.id;
}

// Los placeholders del seed usan URLs absolutas en `storage_path`; las
// imágenes reales subidas por agentes serán paths relativos del bucket
// `property-images` (ver src/lib/images/get-image-url.ts).
async function seedPropertyImages(
  propertyId: string,
  propertyTitle: string,
  propertyIndex: number,
): Promise<void> {
  const { count, error: countError } = await supabase
    .from('property_images')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId);
  if (countError) throw countError;

  if ((count ?? 0) >= IMAGES_PER_PROPERTY) {
    console.log(`    → ya hay ${count} imágenes para "${propertyTitle}"`);
    return;
  }

  const offset = propertyIndex * IMAGES_PER_PROPERTY;
  const rows = Array.from({ length: IMAGES_PER_PROPERTY }, (_, i) => {
    const photoId = UNSPLASH_PHOTO_IDS[(offset + i) % UNSPLASH_PHOTO_IDS.length];
    return {
      property_id: propertyId,
      storage_path: buildUnsplashUrl(photoId),
      is_main: i === 0,
      position: i,
      alt_text: `${propertyTitle} — foto ${i + 1}`,
    };
  });

  const { error: imgError } = await supabase.from('property_images').insert(rows);
  if (imgError) throw imgError;
  console.log(`    ✓ ${rows.length} imágenes placeholder para "${propertyTitle}"`);
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
