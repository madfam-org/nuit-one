export interface AudioInputDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

/**
 * Enumerate available audio input devices.
 * Requests temporary mic access to get device labels (browser requirement).
 */
export async function getAudioInputDevices(): Promise<AudioInputDevice[]> {
  const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const devices = await navigator.mediaDevices.enumerateDevices();
  tempStream.getTracks().forEach(t => t.stop());

  return devices
    .filter(d => d.kind === 'audioinput')
    .map(d => ({
      deviceId: d.deviceId,
      label: d.label || `Input ${d.deviceId.slice(0, 8)}`,
      groupId: d.groupId,
    }));
}
