export type TickerBinding = {
  row: HTMLElement;
  track: HTMLElement;
  segment: HTMLElement;
  direction: -1 | 1;
};

type RowMotion = TickerBinding & {
  width: number;
  position: number;
  velocity: number;
  ambient: number;
  proximity: "visible" | "near" | "far";
};

type PointerMotion = {
  row: RowMotion;
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  claimed: boolean;
};

const MAX_THROW = 1600;
const INTENT_DISTANCE = 8;

/** One scheduler for every ticker. It owns no React state and performs no scroll reads. */
export class TickerEngine {
  private rows = new Map<HTMLElement, RowMotion>();
  private resize: ResizeObserver;
  private visibility: IntersectionObserver;
  private media: MediaQueryList;
  private pointer: PointerMotion | null = null;
  private frame = 0;
  private previous = 0;

  constructor() {
    this.media = matchMedia("(prefers-reduced-motion: reduce)");
    this.resize = new ResizeObserver((entries) => {
      for (const entry of entries) {
        for (const state of this.rows.values()) if (state.segment === entry.target) this.measure(state);
      }
    });
    this.visibility = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const state = this.rows.get(entry.target as HTMLElement);
        if (!state) continue;
        state.proximity = entry.isIntersecting ? (entry.intersectionRatio > 0 ? "visible" : "near") : "far";
      }
      this.ensureFrame();
    }, { rootMargin: "75% 0px", threshold: [0, 0.01] });
    document.addEventListener("visibilitychange", this.onVisibility);
    this.media.addEventListener("change", this.onMotionPreference);
  }

  register(binding: TickerBinding) {
    const state: RowMotion = { ...binding, width: 0, position: 0, velocity: 0, ambient: binding.direction * this.ambientSpeed(), proximity: "near" };
    this.rows.set(binding.row, state);
    this.resize.observe(binding.segment);
    this.visibility.observe(binding.row);
    this.measure(state);
    this.ensureFrame();
    return () => this.unregister(binding.row);
  }

  unregister(row: HTMLElement) {
    const state = this.rows.get(row);
    if (!state) return;
    this.resize.unobserve(state.segment);
    this.visibility.unobserve(row);
    if (this.pointer?.row === state) this.pointer = null;
    this.rows.delete(row);
  }

  nudge(row: HTMLElement, direction: -1 | 1) {
    const state = this.rows.get(row);
    if (state) state.velocity = direction * 520;
    this.ensureFrame();
  }

  pointerDown(event: PointerEvent, row: HTMLElement) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const state = this.rows.get(row);
    if (!state) return;
    this.pointer = { row: state, id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, lastTime: event.timeStamp, velocity: 0, claimed: false };
  }

  pointerMove(event: PointerEvent) {
    const drag = this.pointer;
    if (!drag || drag.id !== event.pointerId) return false;
    const totalX = event.clientX - drag.startX;
    const totalY = event.clientY - drag.startY;
    if (!drag.claimed) {
      if (Math.abs(totalY) > INTENT_DISTANCE && Math.abs(totalY) >= Math.abs(totalX) / 1.2) { this.pointer = null; return false; }
      if (Math.abs(totalX) <= INTENT_DISTANCE || Math.abs(totalX) <= Math.abs(totalY) * 1.2) return false;
      drag.claimed = true;
      drag.row.row.setPointerCapture(event.pointerId);
      drag.row.row.classList.add("is-dragging");
    }
    const dx = event.clientX - drag.lastX;
    const dt = Math.max(8, event.timeStamp - drag.lastTime) / 1000;
    const sample = dx / dt;
    drag.velocity += (sample - drag.velocity) * .28;
    drag.row.position += dx;
    drag.row.velocity = 0;
    drag.lastX = event.clientX; drag.lastY = event.clientY; drag.lastTime = event.timeStamp;
    this.paint(drag.row);
    return true;
  }

  pointerUp(event: PointerEvent) {
    const drag = this.pointer;
    if (!drag || drag.id !== event.pointerId) return false;
    if (drag.claimed) {
      drag.row.velocity = Math.max(-MAX_THROW, Math.min(MAX_THROW, drag.velocity));
      drag.row.row.classList.remove("is-dragging");
      if (drag.row.row.hasPointerCapture(event.pointerId)) drag.row.row.releasePointerCapture(event.pointerId);
    }
    this.pointer = null;
    this.ensureFrame();
    return drag.claimed;
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.resize.disconnect();
    this.visibility.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.media.removeEventListener("change", this.onMotionPreference);
    this.rows.clear();
    this.pointer = null;
  }

  private ambientSpeed() { return this.media.matches ? 0 : (innerWidth <= 700 ? 16 : 23); }
  private measure(state: RowMotion) {
    const width = state.segment.scrollWidth;
    if (!width || width === state.width) return;
    state.width = width;
    state.position = this.wrap(state.position || (state.direction < 0 ? 0 : -width), width);
    this.paint(state);
  }
  private wrap(position: number, width: number) {
    if (!width) return position;
    while (position <= -width) position += width;
    while (position > 0) position -= width;
    return position;
  }
  private paint(state: RowMotion) {
    state.position = this.wrap(state.position, state.width);
    state.track.style.transform = `translate3d(${state.position.toFixed(2)}px,0,0)`;
  }
  private ensureFrame() {
    if (!this.frame && document.visibilityState !== "hidden" && [...this.rows.values()].some((row) => row.proximity !== "far")) {
      this.previous = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    }
  }
  private tick = (time: number) => {
    this.frame = 0;
    const dt = Math.min((time - this.previous) / 1000, .05);
    this.previous = time;
    let active = false;
    for (const state of this.rows.values()) {
      if (state.proximity === "far") continue;
      active = true;
      state.ambient = state.direction * this.ambientSpeed();
      if (this.pointer?.row !== state) {
        const response = Math.abs(state.velocity) > Math.abs(state.ambient) + 2 ? 2.8 : 5;
        const alpha = 1 - Math.exp(-response * dt);
        state.velocity += (state.ambient - state.velocity) * alpha;
        state.position += state.velocity * dt;
        this.paint(state);
      }
    }
    if (active && document.visibilityState !== "hidden") this.frame = requestAnimationFrame(this.tick);
  };
  private onVisibility = () => { if (document.visibilityState === "hidden") { cancelAnimationFrame(this.frame); this.frame = 0; } else this.ensureFrame(); };
  private onMotionPreference = () => { for (const state of this.rows.values()) state.velocity = 0; this.ensureFrame(); };
}
