/**
 * The MADFAM ecosystem banner's platform list and the domains its link policy
 * (`ecosystem-links.ts`) treats as MADFAM-owned.
 *
 * Mirrors `DEFAULT_ECOSYSTEM_PLATFORMS` and `MADFAM_OWNED_DOMAINS` in
 * `@madfam/ecosystem-banner` 0.3.0 (solarpunk-foundry), which this app does not
 * depend on; keep the two in step by hand.
 */
export interface EcosystemPlatform {
  /** Short uppercase keyword shown before the colon, e.g. "BUDGETING & WEALTH". */
  keyword: string;
  /** Platform display name shown after the colon, e.g. "Dhanam". */
  name: string;
  /** Apex URL, e.g. "https://dhan.am". No trailing slash. */
  url: string;
}

export const ECOSYSTEM_PLATFORMS: readonly EcosystemPlatform[] = [
  { keyword: 'BUDGETING & WEALTH', name: 'Dhanam', url: 'https://dhan.am' },
  { keyword: 'AI AGENT OFFICE', name: 'Selva', url: 'https://selva.town' },
  { keyword: 'COMPLIANCE & CFDI', name: 'Karafiel', url: 'https://karafiel.mx' },
  { keyword: 'AUTHENTICATION', name: 'Janua', url: 'https://auth.madfam.io' },
  { keyword: 'DEPLOYMENT', name: 'Enclii', url: 'https://enclii.dev' },
  { keyword: 'LEGAL OPS', name: 'Tezca', url: 'https://tezca.mx' },
  { keyword: 'PHYGITAL FABRICATION', name: 'Yantra4D', url: 'https://yantra4d.com' },
  { keyword: 'QUOTING ENGINE', name: 'Cotiza', url: 'https://cotiza.studio' },
  { keyword: 'INDUSTRY INTELLIGENCE', name: 'Forge Sight', url: 'https://forgesight.app' },
  { keyword: 'MANUFACTURING', name: 'Pravara', url: 'https://mes.madfam.io' },
  { keyword: 'GAMES', name: 'Rondelio', url: 'https://rondel.io' },
  { keyword: 'ROUTING & LOGISTICS', name: 'RouteCraft', url: 'https://routecraft.app' },
  { keyword: 'CLIENT PORTAL & CRM', name: 'PhyndCRM', url: 'https://phynd.app' },
];

/**
 * Registrable domains a cross-property link treats as MADFAM-owned. A host equal
 * to one, or a subdomain of one, is own; the `madfam.io` apex covers every
 * `*.madfam.io` product host. nuit.one is not in the product registry, so it is a
 * link origin (`utm_source=nuit.one`) but not an owned destination.
 */
export const MADFAM_OWNED_DOMAINS: readonly string[] = [
  'madfam.io',
  'enclii.dev',
  'janua.dev',
  'selva.town',
  'forgesight.app',
  'dhan.am',
  'fortuna.tube',
  'rondel.io',
  'karafiel.mx',
  'tezca.mx',
  'avala.studio',
  'yantra4d.com',
  'cotiza.studio',
  'phynd.app',
  'ceq.lol',
  'kalya.app',
  'nauta.quest',
  'fashioncabi.net',
  'factl.as',
  'routecraft.app',
  'telesia.quest',
  'madf.am',
];
