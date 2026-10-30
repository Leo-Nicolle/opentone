// Runs the pattern search off the main thread. In: the current Params, the copper cost and the estimator.
// Out: Progress, the last one `final`.
import { optimize } from "./optimize.ts";
import type { Estimator, Params } from "./geometry.ts";

self.onmessage = (e: MessageEvent<{ params: Params; copperCost: number; est: Estimator }>) =>
  optimize(e.data.params, e.data.copperCost, e.data.est, (p) => self.postMessage(p));
