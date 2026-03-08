import { createDb } from '@nuit-one/db';
import { env } from '$env/dynamic/private';

export const db = createDb(env.DATABASE_URL ?? 'postgres://localhost:5432/nuit');
