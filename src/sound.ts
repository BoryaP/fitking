/** Short beeps for the last seconds of a set or rest and for each phase change. */
export class Beeper {
  enabled = true;
  private ctx: AudioContext | null = null;

  /** Browsers only allow audio after a tap, so call this from a click handler. */
  unlock(): void {
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.ctx.state === "suspended") this.ctx.resume();
    } catch { this.ctx = null; }
  }

  beep(freq = 880, len = 0.22): void {
    if (!this.enabled || !this.ctx) return;
    try {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.15, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + len);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + len + 0.02);
    } catch { /* ignore audio errors */ }
  }
}
