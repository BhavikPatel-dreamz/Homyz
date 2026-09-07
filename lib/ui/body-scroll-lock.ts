let lockCount = 0;
let restore: (() => void) | undefined;

/** Each visible modal owns one release function; nested modals share the lock. */
export function lockBodyScroll(): () => void {
  if (lockCount === 0) {
    const body = document.body;
    const html = document.documentElement;
    const x = window.scrollX;
    const y = window.scrollY;
    const properties = ["position", "top", "left", "width", "overflow", "padding-right"];
    const saved = properties.map((property) => [property, body.style.getPropertyValue(property), body.style.getPropertyPriority(property)]);
    const htmlOverflow = html.style.getPropertyValue("overflow");
    const htmlPriority = html.style.getPropertyPriority("overflow");
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    const paddingRight = parseFloat(window.getComputedStyle(body).paddingRight) || 0;

    // Fixing the body also prevents background touch scrolling on iOS.
    body.style.setProperty("position", "fixed");
    body.style.setProperty("top", `${-y}px`);
    body.style.setProperty("left", `${-x}px`);
    body.style.setProperty("width", "100%");
    body.style.setProperty("overflow", "hidden");
    if (scrollbarWidth > 0) body.style.setProperty("padding-right", `${paddingRight + scrollbarWidth}px`);
    html.style.setProperty("overflow", "hidden");

    restore = () => {
      for (const [property, value, priority] of saved) {
        if (value) body.style.setProperty(property, value, priority);
        else body.style.removeProperty(property);
      }
      if (htmlOverflow) html.style.setProperty("overflow", htmlOverflow, htmlPriority);
      else html.style.removeProperty("overflow");
      window.scrollTo({ left: x, top: y, behavior: "instant" });
    };
  }
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount -= 1;
    if (lockCount === 0) {
      restore?.();
      restore = undefined;
    }
  };
}
