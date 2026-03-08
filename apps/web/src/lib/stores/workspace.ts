import { writable } from 'svelte/store';
import type { Workspace } from '@nuit-one/shared/types';

export const activeWorkspace = writable<Workspace | null>(null);
export const workspaces = writable<Workspace[]>([]);
