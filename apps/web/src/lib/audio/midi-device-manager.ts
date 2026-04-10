export interface MidiInputDevice {
  id: string;
  name: string;
  manufacturer: string;
}

export function isMidiSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

export async function getMidiInputDevices(): Promise<MidiInputDevice[]> {
  if (!isMidiSupported()) return [];

  try {
    const access = await navigator.requestMIDIAccess();
    const devices: MidiInputDevice[] = [];

    for (const input of access.inputs.values()) {
      devices.push({
        id: input.id,
        name: input.name ?? 'Unknown MIDI Device',
        manufacturer: input.manufacturer ?? '',
      });
    }

    return devices;
  } catch {
    return [];
  }
}
