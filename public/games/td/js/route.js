// A route as a polyline in cell units, with the position at any distance
// along it. Enemies carry a distance and are placed from it each frame.
export function buildPath(waypoints) {
  const points = waypoints.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 }));
  const lengths = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    lengths.push(d);
    total += d;
  }
  return { points, lengths, total };
}

/** Which straight of the route a distance along it falls on. */
export function segmentAt(path, distance) {
  let d = Math.max(0, distance);
  for (let i = 0; i < path.lengths.length; i++) {
    if (d <= path.lengths[i]) return i;
    d -= path.lengths[i];
  }
  return path.lengths.length - 1;
}

export function pointAt(path, distance) {
  let d = Math.max(0, distance);
  for (let i = 0; i < path.lengths.length; i++) {
    if (d <= path.lengths[i]) {
      const a = path.points[i], b = path.points[i + 1], t = d / path.lengths[i];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    d -= path.lengths[i];
  }
  const last = path.points[path.points.length - 1];
  return { x: last.x, y: last.y };
}
