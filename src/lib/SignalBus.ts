/**
 * SignalBus — pub/sub singleton linking math drop-ins.
 *
 * Channels carry floating-point values (theta, frequency, amplitude,
 * phase, voltage). A publisher ID prevents echo (a component doesn't
 * receive its own updates).
 *
 * Usage:
 *   signalBus.subscribe("theta", (v) => setTheta(v), myId);
 *   signalBus.publish("theta", 1.57, myId);
 *   signalBus.unsubscribe(myId);
 */

export type SignalChannel = "theta" | "frequency" | "amplitude" | "phase" | "voltage";

interface Subscriber {
  id: string;
  channel: SignalChannel;
  callback: (value: number) => void;
}

class SignalBus {
  private subs: Subscriber[] = [];
  private values: Partial<Record<SignalChannel, number>> = {};

  /** Subscribe to a channel. Returns an unsubscribe function. */
  subscribe(channel: SignalChannel, callback: (value: number) => void, subscriberId: string): () => void {
    this.subs.push({ id: subscriberId, channel, callback });
    // Immediately fire with current value if one exists
    if (this.values[channel] !== undefined) {
      callback(this.values[channel]!);
    }
    return () => {
      this.subs = this.subs.filter(s => !(s.id === subscriberId && s.channel === channel));
    };
  }

  /** Publish a value. All subscribers on `channel` except `publisherId` receive it. */
  publish(channel: SignalChannel, value: number, publisherId: string): void {
    this.values[channel] = value;
    for (const s of this.subs) {
      if (s.channel === channel && s.id !== publisherId) {
        s.callback(value);
      }
    }
  }

  /** Remove all subscriptions for a given component ID. */
  unsubscribe(subscriberId: string): void {
    this.subs = this.subs.filter(s => s.id !== subscriberId);
  }

  /** Get current value of a channel (or undefined). */
  get(channel: SignalChannel): number | undefined {
    return this.values[channel];
  }
}

/** Module-level singleton — no React context needed. */
export const signalBus = new SignalBus();
