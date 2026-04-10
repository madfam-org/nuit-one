import { error, json } from '@sveltejs/kit';
import { getPusher } from '$lib/server/pusher.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');

  const formData = await request.formData();
  const socketId = formData.get('socket_id') as string;
  const channel = formData.get('channel_name') as string;

  if (!socketId || !channel) throw error(400, 'Missing socket_id or channel_name');

  const pusher = getPusher();

  // Presence channels need user data
  if (channel.startsWith('presence-')) {
    const auth = pusher.authorizeChannel(socketId, channel, {
      user_id: locals.userId,
      user_info: {
        workspaceId: locals.workspaceId ?? '',
      },
    });
    return json(auth);
  }

  // Private channels just need authorization
  if (channel.startsWith('private-')) {
    const auth = pusher.authorizeChannel(socketId, channel);
    return json(auth);
  }

  throw error(403, 'Invalid channel');
};
