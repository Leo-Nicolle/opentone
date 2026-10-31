// Builds the fill off the main thread. In: FillInput. Out: progress events, then the meshes.
import { buildFill, type FillInput } from "./fill.ts";

self.onmessage = (e: MessageEvent<FillInput>) => {
  try {
    const out = buildFill(e.data, (stage, pct) => self.postMessage({ type: "progress", stage, pct }));
    const transfer = out.halves.flatMap((h) => [h.positions.buffer, h.indices.buffer]);
    (self as unknown as Worker).postMessage({ type: "done", out }, transfer);
  } catch (err) {
    self.postMessage({ type: "error", message: String(err) });
  }
};
