/**
 * SVG path data parsing.
 *
 * The map asset's own geometry is the only source of truth for where two
 * locations touch — the save carries no adjacency data, and the rendered
 * document exposes shapes but not the borders between them. Walking a path's
 * `d` into coordinates is the primitive both the build-time adjacency
 * generator and the runtime border extraction are built on.
 *
 * Shared by `scripts/generate-location-adjacency.mjs` and the browser, so it
 * lives here rather than in the script. Node strips the types on import.
 *
 * All functions are pure, use immutable variables, and never throw.
 */

/** A point in SVG viewBox user units. */
export type Point = readonly [number, number];

/** Argument count per path command, keyed by its lowercase letter. */
const ARG_COUNT: Readonly<Record<string, number>> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  a: 7,
  z: 0,
};

const COMMAND_RUN = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
const NUMBER = /-?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

/** Parse every number out of a command's argument run. */
const parseNumbers = (run: string): number[] =>
  [...run.matchAll(NUMBER)].map((m) => parseFloat(m[0]));

/**
 * Walk a path's `d` and return its segment endpoints grouped by subpath.
 *
 * A location is often several rings — a mainland and its islands — and they
 * are not connected to each other. Consecutive vertices within one ring are
 * joined by a real path segment; the step from the end of one ring to the
 * start of the next crosses open water. Keeping the grouping is what lets a
 * caller tell those apart, rather than guessing from how far the step is.
 *
 * Only endpoints are kept. Control points sit off the border, so including
 * them would pull false matches toward shapes the path does not actually
 * touch. The endpoints alone are dense enough to describe a border: this
 * asset averages some dozens of commands per location.
 *
 * Malformed data yields fewer vertices rather than an error — a shape that
 * cannot be read simply contributes nothing downstream.
 */
export const pathSubpaths = (d: string): Point[][] => {
  const rings: Point[][] = [];
  let points: Point[] = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  for (const match of d.matchAll(COMMAND_RUN)) {
    const command = match[1];
    const lower = command.toLowerCase();
    const relative = command === lower;
    const argc = ARG_COUNT[lower];

    if (argc === 0) {
      // Z returns to the start of the current subpath.
      x = startX;
      y = startY;
      points.push([x, y]);
      continue;
    } else {
      /* command carries arguments — read them below */
    }

    const args = parseNumbers(match[2]);
    for (let i = 0; i + argc <= args.length; i += argc) {
      const a = args.slice(i, i + argc);

      if (lower === "m") {
        x = relative ? x + a[0] : a[0];
        y = relative ? y + a[1] : a[1];
        // Only the first pair of an `m` run is a move; the rest are implicit
        // linetos, so they must not move where Z returns to, nor open a ring.
        if (i === 0) {
          startX = x;
          startY = y;
          if (points.length > 0) {
            rings.push(points);
            points = [];
          } else {
            /* nothing accumulated yet — this is the first ring */
          }
        } else {
          /* implicit lineto — subpath start is unchanged */
        }
      } else if (lower === "l") {
        x = relative ? x + a[0] : a[0];
        y = relative ? y + a[1] : a[1];
      } else if (lower === "h") {
        x = relative ? x + a[0] : a[0];
      } else if (lower === "v") {
        y = relative ? y + a[0] : a[0];
      } else if (lower === "c") {
        x = relative ? x + a[4] : a[4];
        y = relative ? y + a[5] : a[5];
      } else if (lower === "s" || lower === "q") {
        x = relative ? x + a[2] : a[2];
        y = relative ? y + a[3] : a[3];
      } else if (lower === "t") {
        x = relative ? x + a[0] : a[0];
        y = relative ? y + a[1] : a[1];
      } else if (lower === "a") {
        x = relative ? x + a[5] : a[5];
        y = relative ? y + a[6] : a[6];
      } else {
        /* unreachable — ARG_COUNT covers every command the regex matches */
      }

      points.push([x, y]);
    }
  }

  if (points.length > 0) {
    rings.push(points);
  } else {
    /* the last ring was already closed off, or there was nothing to read */
  }

  return rings;
};

/**
 * Every segment endpoint of a path, in order, with the subpath grouping
 * flattened away.
 *
 * Callers that only ask "is there a vertex near this point?" do not care
 * which ring it came from.
 */
export const pathVertices = (d: string): Point[] => pathSubpaths(d).flat();
