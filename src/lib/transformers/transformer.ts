// Transforms byte arrays for purposes of network traffic obfuscation.
export interface Transformer {
  // Configures the transformer with an implementation-specific string.
  // Intended to be called once, immediately after creation and before any
  // packets are transformed or restored.
  // TODO: remove this, configure on construction
  configure(config: string): void;

  // Returns the obfuscated form of p, as one or more (in the case of
  // fragmentation) ArrayBuffers.
  transform(p: ArrayBuffer): ArrayBuffer[];

  // Returns a zero (if p is not the final or only fragment of a packet) or
  // one-length list of ArrayBuffers of the original, unobfuscated form of c.
  restore(c: ArrayBuffer): ArrayBuffer[];
}
