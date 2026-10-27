// The designer's shared state: parameters, the finger, and what derives from them.
// Made once per <Clickwheel> and handed to its panels with provide/inject.
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch, type InjectionKey } from "vue";
import { useData } from "vitepress";
import { D2R, DEFAULTS, buildGeo, buildSweep, cover, estimate, mod, padColors, toUiDeg, wrapPI, type FieldDef, type Params } from "./geometry.ts";

export type Pt = { x: number; y: number };

/** Inner, middle and outer test track. */
export const TRACK_COLORS = ["var(--cw-brand)", "var(--cw-sgreen)", "var(--cw-amber)"];

/** Reads and writes the number behind a field row. */
export type FieldBind = { get(): number; set(v: number): void };
export type FieldModel = ReturnType<ReturnType<typeof createClickwheel>["bindField"]>;

const polar = (rho: number, uiDeg: number): Pt => {
  const a = (uiDeg - 90) * D2R;
  return { x: rho * Math.cos(a), y: rho * Math.sin(a) };
};
const defaultPin = (p: Params) => polar((p.od + p.id) / 4, 30);

// The sweep samples ~200k points; slider drags recompute it at most this often.
const SWEEP_DEBOUNCE_MS = 40;

export function createClickwheel() {
  const { isDark } = useData();
  const params = reactive<Params>({ ...DEFAULTS });
  const raw = reactive<Record<string, string>>({});
  const paint = ref<"pads" | "copper">("pads");
  const layers = reactive({ edge: true, dims: true, tracks: false });
  const hover = ref<Pt | null>(null);
  const pin = ref<Pt>(defaultPin(DEFAULTS));
  const sweeping = ref(false);

  // Geometry is keyed by everything but the finger; the sweep also by the finger.
  const model = computed(() => buildGeo(params));
  const sweep = shallowRef(buildSweep(model.value.g, params.finger));
  let sweepTimer: ReturnType<typeof setTimeout> | undefined;
  watch([model, () => params.finger], () => {
    clearTimeout(sweepTimer);
    sweepTimer = setTimeout(() => (sweep.value = buildSweep(model.value.g, params.finger)), SWEEP_DEBOUNCE_MS);
  });

  const colors = computed(() => padColors(model.value.g.N, isDark.value));

  function set(key: keyof Params, v: number) {
    params[key] = v;
    if (key === "od" && params.id > v - 2) params.id = Math.max(0, v - 2);
  }

  /** v-model helpers for one field row: clamped steps and the typed text. */
  function bindField(def: () => FieldDef, bind: FieldBind) {
    const clampSet = (v: number) => {
      const f = def();
      bind.set(+Math.max(f.min, Math.min(f.max, v)).toFixed(4));
    };
    return {
      value: () => bind.get(),
      text: () => raw[def().key] ?? bind.get().toFixed(def().decimals),
      range: (v: number) => {
        delete raw[def().key];
        clampSet(v);
      },
      // Keep the raw text while typing; commit only parseable, in-range values.
      type: (t: string) => {
        const f = def(), n = parseFloat(t);
        raw[f.key] = t;
        if (!isNaN(n) && n >= f.min && n <= f.max) bind.set(n);
      },
      blur: () => delete raw[def().key],
      step: (dir: 1 | -1) => clampSet(bind.get() + dir * def().step),
    };
  }

  function field(f: FieldDef) {
    const key = f.key as keyof Params;
    return bindField(() => f, { get: () => params[key], set: (v) => set(key, v) });
  }

  function load(p: Params) {
    Object.assign(params, p);
    for (const k of Object.keys(raw)) delete raw[k];
  }

  function reset() {
    stopSweep();
    load({ ...DEFAULTS });
    pin.value = defaultPin(DEFAULTS);
  }

  // --- The finger and what the pads report under it ---------------------------

  const finger = computed(() => (sweeping.value ? pin.value : (hover.value ?? pin.value)));

  const reading = computed(() => {
    const m = model.value, g = m.g, f = finger.value, fr = params.finger / 2;
    const cov = cover(g, f.x, f.y, fr, 33), est = estimate(g, cov);
    const rho = Math.hypot(f.x, f.y), act = Math.atan2(f.y, f.x);
    const onWheel = rho >= g.r - fr && rho <= g.R + fr;
    let err: number | null = null, reported: number | null = null;
    if (est != null && onWheel) {
      err = wrapPI(est - sweep.value.offset - act);
      reported = act + err;
    }
    return { cov, rho, act, onWheel, err, reported };
  });

  const status = computed(() => (sweeping.value ? "sweeping" : hover.value ? "live" : "pinned"));

  /** Whether a point lies on the copper ring, where hovering and pinning count. */
  function onRing(p: Pt) {
    const g = model.value.g, rho = Math.hypot(p.x, p.y);
    return rho >= g.r && rho <= g.R;
  }

  /** Distance of the pinned finger, kept on the copper. */
  const pinRadius = () => {
    const g = model.value.g;
    return Math.max(g.r, Math.min(g.R, Math.hypot(pin.value.x, pin.value.y)));
  };

  /** Point at UI angle fraction f (0..1 of a turn) at the pinned finger's distance. */
  const atPinRadius = (f: number) => polar(pinRadius(), f * 360);

  /** Hover the finger at p; null (or a point off the ring) hands it back to the pin. */
  function point(p: Pt | null) {
    if (!sweeping.value) hover.value = p && onRing(p) ? p : null;
  }
  function pinAt(p: Pt) {
    if (!sweeping.value && onRing(p)) pin.value = p;
  }

  // Leaving the window (alt-tab, devtools) never fires pointerleave.
  const dropHover = () => (hover.value = null);
  onMounted(() => window.addEventListener("blur", dropHover));
  onBeforeUnmount(() => window.removeEventListener("blur", dropHover));

  // The pinned finger's position, as fields. Typing one stops a running sweep.
  const distanceDef = computed<FieldDef>(() => {
    const g = model.value.g;
    return {
      key: "distance", label: "Distance from centre", unit: "mm", min: +g.r.toFixed(1), max: +g.R.toFixed(1), step: 0.1, decimals: 1,
      hint: `Centre of the finger. The copper runs from ${g.r.toFixed(1)} to ${g.R.toFixed(1)} mm.`,
    };
  });
  const angleDef: FieldDef = {
    key: "angle", label: "Angle", unit: "°", min: 0, max: 360, step: 1, decimals: 1, hint: "Clockwise from 12 o’clock.",
  };
  const pinAngle = () => toUiDeg(Math.atan2(pin.value.y, pin.value.x));
  const movePin = (p: Pt) => {
    stopSweep();
    pin.value = p;
  };
  const distanceField = bindField(() => distanceDef.value, {
    get: () => Math.hypot(pin.value.x, pin.value.y),
    set: (v) => movePin(polar(v, pinAngle())),
  });
  const angleField = bindField(() => angleDef, {
    get: pinAngle,
    set: (v) => movePin(polar(Math.hypot(pin.value.x, pin.value.y), mod(v, 360))),
  });

  // One turn at the pin's radius: +4° every 33 ms, 90 steps, then stays pinned.
  let timer: ReturnType<typeof setInterval> | undefined;
  function startSweep() {
    if (timer) return;
    const g = model.value.g, p0 = pin.value;
    const r0 = Math.max(g.r + 0.5, Math.min(g.R - 0.5, Math.hypot(p0.x, p0.y)));
    let a = Math.atan2(p0.y, p0.x), n = 0;
    sweeping.value = true;
    hover.value = null;
    timer = setInterval(() => {
      a += 4 * D2R;
      pin.value = { x: r0 * Math.cos(a), y: r0 * Math.sin(a) };
      if (++n >= 90) stopSweep();
    }, 33);
  }
  function stopSweep() {
    clearInterval(timer);
    timer = undefined;
    sweeping.value = false;
  }
  onBeforeUnmount(() => {
    stopSweep();
    clearTimeout(sweepTimer);
  });

  return {
    params, paint, layers, hover, pin, sweeping, model, sweep, colors, finger, reading, status,
    distanceDef, angleDef, distanceField, angleField,
    bindField, field, load, reset, point, pinAt, pinRadius, atPinRadius, startSweep,
  };
}

export type ClickwheelState = ReturnType<typeof createClickwheel>;
export const CLICKWHEEL: InjectionKey<ClickwheelState> = Symbol("clickwheel");
export const useClickwheel = () => inject(CLICKWHEEL)!;
