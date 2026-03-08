export interface Command {
  execute(): void;
  undo(): void;
  readonly description: string;
}

export class CommandStack {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  execute(cmd: Command): void {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack = [];

    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }

  undo(): void {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.undo();
    this.redoStack.push(cmd);
  }

  redo(): void {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.execute();
    this.undoStack.push(cmd);
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoDescription(): string | undefined {
    return this.undoStack[this.undoStack.length - 1]?.description;
  }

  get redoDescription(): string | undefined {
    return this.redoStack[this.redoStack.length - 1]?.description;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
