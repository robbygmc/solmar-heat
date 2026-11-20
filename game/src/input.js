// SOLMAR HEAT — keyboard and mouse input.
// One clear job: turn browser events into a plain state object the game reads.
// Pointer lock gives the mouse-look camera; the game never reads events directly.
export function createInput(canvas) {
  const keys = new Set();
  const pressedSet = new Set();
  const state = {
    keys,
    mouseDX: 0,
    mouseDY: 0,
    mouseDown: false,
    locked: false,
    // True while any of the given codes is held.
    any(...codes) {
      for (const code of codes) if (keys.has(code)) return true;
      return false;
    },
    // True once for a key pressed since the last frame.
    pressed(code) {
      return pressedSet.has(code);
    },
  };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    pressedSet.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    pressedSet.clear();
    // A mouse button released off-window never fires mouseup here, so a
    // stuck mouseDown would keep firing the pistol on return.
    state.mouseDown = false;
  });
  document.addEventListener('mousemove', (event) => {
    if (!state.locked) return;
    state.mouseDX += event.movementX;
    state.mouseDY += event.movementY;
  });
  document.addEventListener('mousedown', (event) => {
    if (event.button === 0) state.mouseDown = true;
  });
  document.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.mouseDown = false;
  });
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
  });

  return {
    state,
    lockPointer() {
      if (document.pointerLockElement !== canvas) {
        try {
          // Chrome returns a promise that rejects when the lock is refused
          // (e.g. headless); swallow it — the game still plays with keys.
          const p = canvas.requestPointerLock();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch {
          // Pointer lock can fail in headless runs; the game still plays with keys.
        }
      }
    },
    unlockPointer() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    // Call once per frame after the game has read the state.
    endFrame() {
      state.mouseDX = 0;
      state.mouseDY = 0;
      pressedSet.clear();
    },
  };
}
