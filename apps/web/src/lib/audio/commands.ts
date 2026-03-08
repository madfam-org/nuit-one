import type { Command } from './command-stack.js';
import type { PlayerStore } from '$lib/stores/player.svelte.js';

export class VolumeChangeCommand implements Command {
  readonly description: string;
  constructor(
    private store: PlayerStore,
    private stemName: string,
    private oldValue: number,
    private newValue: number,
  ) {
    this.description = `Change ${stemName} volume`;
  }
  execute() { this.store.setVolume(this.stemName, this.newValue); }
  undo() { this.store.setVolume(this.stemName, this.oldValue); }
}

export class PanChangeCommand implements Command {
  readonly description: string;
  constructor(
    private store: PlayerStore,
    private stemName: string,
    private oldValue: number,
    private newValue: number,
  ) {
    this.description = `Change ${stemName} pan`;
  }
  execute() { this.store.setPan(this.stemName, this.newValue); }
  undo() { this.store.setPan(this.stemName, this.oldValue); }
}

export class MuteToggleCommand implements Command {
  readonly description: string;
  constructor(
    private store: PlayerStore,
    private stemName: string,
  ) {
    this.description = `Toggle ${stemName} mute`;
  }
  execute() { this.store.toggleMute(this.stemName); }
  undo() { this.store.toggleMute(this.stemName); }
}

export class SoloCommand implements Command {
  readonly description: string;
  private wasSolo: boolean;
  constructor(
    private store: PlayerStore,
    private stemName: string,
    wasSolo: boolean,
  ) {
    this.wasSolo = wasSolo;
    this.description = wasSolo ? `Unsolo ${stemName}` : `Solo ${stemName}`;
  }
  execute() {
    if (this.wasSolo) this.store.unsolo();
    else this.store.solo(this.stemName);
  }
  undo() {
    if (this.wasSolo) this.store.solo(this.stemName);
    else this.store.unsolo();
  }
}

export class EqChangeCommand implements Command {
  readonly description: string;
  constructor(
    private store: PlayerStore,
    private stemName: string,
    private band: 'low' | 'mid' | 'high',
    private oldValue: number,
    private newValue: number,
  ) {
    this.description = `Change ${stemName} EQ ${band}`;
  }
  execute() { this.store.setEq(this.stemName, this.band, this.newValue); }
  undo() { this.store.setEq(this.stemName, this.band, this.oldValue); }
}

export class ReverbChangeCommand implements Command {
  readonly description: string;
  constructor(
    private store: PlayerStore,
    private stemName: string,
    private oldValue: number,
    private newValue: number,
  ) {
    this.description = `Change ${stemName} reverb`;
  }
  execute() { this.store.setReverbSend(this.stemName, this.newValue); }
  undo() { this.store.setReverbSend(this.stemName, this.oldValue); }
}
