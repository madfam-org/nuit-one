import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { activeWorkspace, workspaces } from './workspace';
import type { Workspace } from '@nuit-one/shared/types';

const fixtureWorkspace: Workspace = {
	id: 'ws-001',
	name: 'Test Studio',
	slug: 'test-studio',
	avatarUrl: null,
	memberCount: 3,
	role: 'owner',
};

const fixtureWorkspaceB: Workspace = {
	id: 'ws-002',
	name: 'Collab Space',
	slug: 'collab-space',
	avatarUrl: 'https://example.com/avatar.png',
	memberCount: 12,
	role: 'member',
};

describe('activeWorkspace store', () => {
	beforeEach(() => {
		activeWorkspace.set(null);
	});

	it('has initial value of null', () => {
		expect(get(activeWorkspace)).toBeNull();
	});

	it('can set a workspace', () => {
		activeWorkspace.set(fixtureWorkspace);
		expect(get(activeWorkspace)).toEqual(fixtureWorkspace);
	});

	it('can change from one workspace to another', () => {
		activeWorkspace.set(fixtureWorkspace);
		activeWorkspace.set(fixtureWorkspaceB);
		expect(get(activeWorkspace)).toEqual(fixtureWorkspaceB);
	});

	it('can be reset to null', () => {
		activeWorkspace.set(fixtureWorkspace);
		activeWorkspace.set(null);
		expect(get(activeWorkspace)).toBeNull();
	});

	it('notifies subscribers when updated', () => {
		const values: (Workspace | null)[] = [];
		const unsubscribe = activeWorkspace.subscribe((ws) => {
			values.push(ws);
		});

		activeWorkspace.set(fixtureWorkspace);
		activeWorkspace.set(null);

		// Initial value + 2 updates
		expect(values).toEqual([null, fixtureWorkspace, null]);

		unsubscribe();
	});
});

describe('workspaces store', () => {
	beforeEach(() => {
		workspaces.set([]);
	});

	it('has initial value of an empty array', () => {
		expect(get(workspaces)).toEqual([]);
	});

	it('can set a list of workspaces', () => {
		const list = [fixtureWorkspace, fixtureWorkspaceB];
		workspaces.set(list);
		expect(get(workspaces)).toEqual(list);
		expect(get(workspaces)).toHaveLength(2);
	});

	it('can append a workspace via update', () => {
		workspaces.set([fixtureWorkspace]);
		workspaces.update((list) => [...list, fixtureWorkspaceB]);

		const current = get(workspaces);
		expect(current).toHaveLength(2);
		expect(current[0].id).toBe('ws-001');
		expect(current[1].id).toBe('ws-002');
	});

	it('can remove a workspace via update', () => {
		workspaces.set([fixtureWorkspace, fixtureWorkspaceB]);
		workspaces.update((list) => list.filter((ws) => ws.id !== 'ws-001'));

		const current = get(workspaces);
		expect(current).toHaveLength(1);
		expect(current[0].id).toBe('ws-002');
	});

	it('can be cleared back to empty', () => {
		workspaces.set([fixtureWorkspace, fixtureWorkspaceB]);
		workspaces.set([]);
		expect(get(workspaces)).toEqual([]);
	});

	it('notifies subscribers when the list changes', () => {
		const lengths: number[] = [];
		const unsubscribe = workspaces.subscribe((list) => {
			lengths.push(list.length);
		});

		workspaces.set([fixtureWorkspace]);
		workspaces.set([fixtureWorkspace, fixtureWorkspaceB]);
		workspaces.set([]);

		// Initial (0) + three updates
		expect(lengths).toEqual([0, 1, 2, 0]);

		unsubscribe();
	});
});
