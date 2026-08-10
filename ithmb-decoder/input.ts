export function setupHoldRepeat(elementId: string, action: () => void): void {
  const el = document.getElementById(elementId);
  if (!el) return;
  let timer: number | null = null;

  // Fire once immediately, then every 30ms while held (after a 400ms
  // grace period). Shared by the mouse and touch paths — the only
  // difference is which events cancel the repeat.
  const startRepeat = (cancelEvents: string[]): void => {
    action();
    const timeout = setTimeout(() => {
      timer = window.setInterval(action, 30);
    }, 400);
    const cancel = (): void => {
      clearTimeout(timeout);
      if (timer !== null) clearInterval(timer);
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
