import Pusher from 'pusher';
import { env } from '$env/dynamic/private';

let _pusher: Pusher | null = null;

export function getPusher(): Pusher {
  if (!_pusher) {
    _pusher = new Pusher({
      appId: env.SOKETI_APP_ID ?? 'nuit-one',
      key: env.SOKETI_APP_KEY ?? 'nuit-one-key',
      secret: env.SOKETI_APP_SECRET ?? 'nuit-one-secret',
      host: env.SOKETI_HOST ?? 'localhost',
      port: env.SOKETI_PORT ?? '6001',
      useTLS: false,
      cluster: 'mt1',
    });
  }
  return _pusher;
}
