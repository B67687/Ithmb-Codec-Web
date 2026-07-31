export function setupHoldRepeat(elementId, action) {
  const el = document.getElementById(elementId);
  if (!el) return;
  let timer = null;

  const fire = () => {
    action();
  };

  el.addEventListener("mousedown", () => {
    fire();
    const timeout = setTimeout(() => {
      timer = setInterval(fire, 30);
    }, 400);
    const cancel = () => {
      clearTimeout(timeout);
      clearInterval(timer);
      timer = null;
    };
    el.addEventListener("mouseup", cancel, { once: true });
    el.addEventListener("mouseleave", cancel, { once: true });
  });

  el.addEventListener("touchstart", (e) => {
    e.preventDefault();
    fire();
    const timeout = setTimeout(() => {
      timer = setInterval(fire, 30);
    }, 400);
    const cancel = () => {
      clearTimeout(timeout);
      clearInterval(timer);
      timer = null;
    };
    el.addEventListener("touchend", cancel, { once: true });
    el.addEventListener("touchcancel", cancel, { once: true });
  });
}
