import { describe, it, expect, vi } from 'vitest';
import {
  VolumeChangeCommand,
  PanChangeCommand,
  MuteToggleCommand,
  SoloCommand,
  EqChangeCommand,
  ReverbChangeCommand,
} from './commands.js';
import type { PlayerStore } from '$lib/stores/player.svelte.js';

function mockStore() {
  return {
    setVolume: vi.fn(),
    setPan: vi.fn(),
    toggleMute: vi.fn(),
    solo: vi.fn(),
    unsolo: vi.fn(),
    setEq: vi.fn(),
    setReverbSend: vi.fn(),
  } as unknown as PlayerStore;
}

describe('VolumeChangeCommand', () => {
  it('executes and undoes volume changes', () => {
    const store = mockStore();
    const cmd = new VolumeChangeCommand(store, 'bass', 0.5, 0.8);
    cmd.execute();
    expect(store.setVolume).toHaveBeenCalledWith('bass', 0.8);
    cmd.undo();
    expect(store.setVolume).toHaveBeenCalledWith('bass', 0.5);
  });

  it('has descriptive description', () => {
    const store = mockStore();
    const cmd = new VolumeChangeCommand(store, 'drums', 0, 1);
    expect(cmd.description).toBe('Change drums volume');
  });
});

describe('PanChangeCommand', () => {
  it('executes and undoes pan changes', () => {
    const store = mockStore();
    const cmd = new PanChangeCommand(store, 'guitar', 0, -0.5);
    cmd.execute();
    expect(store.setPan).toHaveBeenCalledWith('guitar', -0.5);
    cmd.undo();
    expect(store.setPan).toHaveBeenCalledWith('guitar', 0);
  });
});

describe('MuteToggleCommand', () => {
  it('toggles mute on execute and undo', () => {
    const store = mockStore();
    const cmd = new MuteToggleCommand(store, 'vocals');
    cmd.execute();
    expect(store.toggleMute).toHaveBeenCalledWith('vocals');
    cmd.undo();
    expect(store.toggleMute).toHaveBeenCalledTimes(2);
  });
});

describe('SoloCommand', () => {
  it('solos on execute and unsolos on undo', () => {
    const store = mockStore();
    const cmd = new SoloCommand(store, 'bass', false);
    cmd.execute();
    expect(store.solo).toHaveBeenCalledWith('bass');
    cmd.undo();
    expect(store.unsolo).toHaveBeenCalled();
  });

  it('unsolos on execute and re-solos on undo when wasSolo=true', () => {
    const store = mockStore();
    const cmd = new SoloCommand(store, 'bass', true);
    cmd.execute();
    expect(store.unsolo).toHaveBeenCalled();
    cmd.undo();
    expect(store.solo).toHaveBeenCalledWith('bass');
  });
});

describe('EqChangeCommand', () => {
  it('executes and undoes EQ changes', () => {
    const store = mockStore();
    const cmd = new EqChangeCommand(store, 'bass', 'low', 0, 6);
    cmd.execute();
    expect(store.setEq).toHaveBeenCalledWith('bass', 'low', 6);
    cmd.undo();
    expect(store.setEq).toHaveBeenCalledWith('bass', 'low', 0);
  });
});

describe('ReverbChangeCommand', () => {
  it('executes and undoes reverb changes', () => {
    const store = mockStore();
    const cmd = new ReverbChangeCommand(store, 'vocals', 0, 0.5);
    cmd.execute();
    expect(store.setReverbSend).toHaveBeenCalledWith('vocals', 0.5);
    cmd.undo();
    expect(store.setReverbSend).toHaveBeenCalledWith('vocals', 0);
  });
});
