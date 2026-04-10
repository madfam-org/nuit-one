import { error } from '@sveltejs/kit';
import { fetchUserInfo } from '$lib/server/auth.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.userId) {
    throw error(401, 'Unauthorized');
  }

  // In dev mode, return placeholder data
  if (process.env.NODE_ENV !== 'production') {
    return {
      user: {
        id: locals.userId,
        email: 'dev@nuit.one',
        displayName: 'Developer',
      },
      workspace: {
        id: locals.workspaceId ?? 'dev-workspace',
        name: 'Dev Workspace',
        slug: 'dev',
        role: 'owner',
      },
    };
  }

  // Production: fetch real user profile from Janua
  try {
    const userInfo = await fetchUserInfo(locals.accessToken!);
    return {
      user: {
        id: userInfo.sub,
        email: userInfo.email ?? '',
        displayName: userInfo.name ?? userInfo.preferred_username ?? userInfo.email ?? 'User',
      },
      workspace: {
        id: locals.workspaceId ?? '',
        name: locals.workspaceId ?? '',
        slug: locals.workspaceId ?? '',
        role: locals.roles?.[0] ?? 'member',
      },
    };
  } catch {
    // Fallback if userinfo fails
    return {
      user: {
        id: locals.userId,
        email: '',
        displayName: 'User',
      },
      workspace: {
        id: locals.workspaceId ?? '',
        name: '',
        slug: '',
        role: 'member',
      },
    };
  }
};
