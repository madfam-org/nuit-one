import { describe, expect, it, vi } from 'vitest';
import { type Command, CommandStack } from './command-stack.js';

function mockCommand(
  desc = 'test',
): Command & { executeFn: ReturnType<typeof vi.fn>; undoFn: ReturnType<typeof vi.fn> } {
  const executeFn = vi.fn();
  const undoFn = vi.fn();
  return {
    execute: executeFn,
    undo: undoFn,
    description: desc,
    executeFn,
    undoFn,
  };
}

describe('CommandStack', () => {
  it('executes a command', () => {
    const stack = new CommandStack();
    const cmd = mockCommand();
    stack.execute(cmd);
    expect(cmd.executeFn).toHaveBeenCalledOnce();
    expect(stack.canUndo).toBe(true);
    expect(stack.canRedo).toBe(false);
  });

  it('undoes a command', () => {
    const stack = new CommandStack();
    const cmd = mockCommand();
    stack.execute(cmd);
    stack.undo();
    expect(cmd.undoFn).toHaveBeenCalledOnce();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(true);
  });

  it('redoes a command', () => {
    const stack = new CommandStack();
    const cmd = mockCommand();
    stack.execute(cmd);
    stack.undo();
    stack.redo();
    expect(cmd.executeFn).toHaveBeenCalledTimes(2);
    expect(stack.canUndo).toBe(true);
    expect(stack.canRedo).toBe(false);
  });

  it('clears redo stack on new execute', () => {
    const stack = new CommandStack();
    const cmd1 = mockCommand('first');
    const cmd2 = mockCommand('second');
    stack.execute(cmd1);
    stack.undo();
    expect(stack.canRedo).toBe(true);
    stack.execute(cmd2);
    expect(stack.canRedo).toBe(false);
  });

  it('respects maxSize', () => {
    const stack = new CommandStack(3);
    for (let i = 0; i < 5; i++) {
      stack.execute(mockCommand(`cmd-${i}`));
    }
    // Only 3 undos possible
    let undoCount = 0;
    while (stack.canUndo) {
      stack.undo();
      undoCount++;
    }
    expect(undoCount).toBe(3);
  });

  it('provides undo/redo descriptions', () => {
    const stack = new CommandStack();
    expect(stack.undoDescription).toBeUndefined();
    stack.execute(mockCommand('set volume'));
    expect(stack.undoDescription).toBe('set volume');
    stack.undo();
    expect(stack.redoDescription).toBe('set volume');
  });

  it('handles undo on empty stack gracefully', () => {
    const stack = new CommandStack();
    stack.undo();
    expect(stack.canUndo).toBe(false);
  });

  it('handles redo on empty stack gracefully', () => {
    const stack = new CommandStack();
    stack.redo();
    expect(stack.canRedo).toBe(false);
  });

  it('clears all stacks', () => {
    const stack = new CommandStack();
    stack.execute(mockCommand());
    stack.execute(mockCommand());
    stack.undo();
    expect(stack.canUndo).toBe(true);
    expect(stack.canRedo).toBe(true);
    stack.clear();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
  });
});
