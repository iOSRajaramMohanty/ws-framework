const SEP = ":";

export function encodeNamespacedEvent(namespace: string, event: string): string {
  return event.length === 0 ? `${namespace}${SEP}` : `${namespace}${SEP}${event}`;
}

export function tryDecodeNamespacedEvent(event: string): { namespace: string; event: string } | undefined {
  const idx = event.indexOf(SEP);
  if (idx <= 0) {
    return undefined;
  }
  const ns = event.slice(0, idx);
  const ev = event.slice(idx + 1);
  if (ns.length === 0 || ev.length === 0) {
    return undefined;
  }
  return { namespace: ns, event: ev };
}

