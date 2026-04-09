import type { Workspace } from '@nuit-one/shared/types';
import { writable } from 'svelte/store';

export const activeWorkspace = writable<Workspace | null>(null);
export const workspaces = writable<Workspace[]>([]);
