
interface ProxyConfig {
  // If |allowNonUnicast === false| then any proxy attempt that results
  // in a non-unicast (e.g. local network) address will fail.
  allowNonUnicast :boolean;
}

export = ProxyConfig;
