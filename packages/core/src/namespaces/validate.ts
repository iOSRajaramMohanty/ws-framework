const SEP = ":";

export function validateNamespaceName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error("Namespace name must be a non-empty string.");
  }
  if (trimmed.includes(SEP)) {
    throw new Error(`Namespace name must not include '${SEP}'.`);
  }
  return trimmed;
}

