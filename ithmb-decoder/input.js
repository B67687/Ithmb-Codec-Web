export function setupHoldRepeat(elementId, action) {
  const el = document.getElementById(elementId);
  if (!el) return;
  let timer = null;

  // Fire once immediately, then every 30ms while held (after a 400ms
  // grace period). Shared by the mouse and touch paths — the only
  // difference is which events cancel the repeat.
  const startRepeat = (cancelEvents) => {
    action();
    const timeout = setTimeout(() => {
      timer = setInterval(action, 30);
    }, 400);
    const cancel = () => {
      clearTimeout(timeout);
      clearInterval(timer);
      timer = null;
    };
    for (const ev of cancelEvents) el.addEventListener(ev, cancel, { once: true });
  };

  el.addEventListener("mousedown", () => {
    startRepeat(["mouseup", "mouseleave"]);
  });

  el.addEventListener("touchstart", (e) => {
    e.preventDefault();
    startRepeat(["touchend", "touchcancel"]);
  });
}
