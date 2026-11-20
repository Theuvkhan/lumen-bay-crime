// Keyboard, mouse-look and pointer lock. Movement axes and one-shot actions are read by the game
// each frame; the mouse deltas accumulate between frames and are consumed by the camera.

const KEY_ACTION = {
  KeyE: 'enter',
  Space: 'brake',
  Digit1: 'mission1',
  Digit2: 'mission2',
  Digit3: 'mission3',
  Digit4: 'mission4',
  KeyM: 'missions',
  KeyP: 'pause',
  Escape: 'pause',
  KeyF: 'mute',
  Enter: 'confirm',
};

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let locked = false;

  window.addEventListener('keydown', (event) => {
    const action = KEY_ACTION[event.code];
    if (action) {
      if (!down.has(event.code)) pressed.add(action);
      event.preventDefault();
    }
    down.add(event.code);
  });
  window.addEventListener('keyup', (event) => down.delete(event.code));
  window.addEventListener('blur', () => down.clear());

  canvas.addEventListener('mousedown', () => {
    if (!locked && canvas.requestPointerLock) canvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  window.addEventListener('mousemove', (event) => {
    if (locked) {
      mouseDX += event.movementX;
      mouseDY += event.movementY;
    }
  });

  return {
    /** Whether `code` (a KeyboardEvent.code) is held. */
    key(code) {
      return down.has(code);
    },
    /** Mouse movement accumulated since the last consume, in pixels. */
    mouse() {
      const delta = { x: mouseDX, y: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return delta;
    },
    /** Whether a one-shot action fired since the last consume. */
    take(action) {
      if (pressed.has(action)) {
        pressed.delete(action);
        return true;
      }
      return false;
    },
    /** Drop every pending one-shot action (used when a screen change would eat them). */
    clear() {
      pressed.clear();
    },
    get locked() {
      return locked;
    },
  };
}
