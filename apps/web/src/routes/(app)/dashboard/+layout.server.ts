import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  // TODO: Fetch user data and workspaces from Janua
  return {
    user: {
      id: 'dev-user',
      email: 'dev@nuit.one',
      displayName: 'Developer',
    },
    workspace: {
      id: 'dev-workspace',
      name: 'Dev Workspace',
      slug: 'dev',
      role: 'owner',
    },
  };
};
