// Telemetry endpoint
export const TELEMETRY_URL = "https://ithmb-telemetry.ithmb-codec.workers.dev";

// Known format prefixes from our profile database
export const KNOWN_PREFIXES = new Set([
  1005, 1007, 1009, 1010, 1013, 1015, 1016, 1017, 1019, 1020, 1023, 1024, 1027,
  1028, 1029, 1031, 1032, 1036, 1042, 1043, 1044, 1055, 1056, 1060, 1061, 1062,
  1066, 1067, 1068, 1071, 1073, 1074, 1078, 1079, 1081, 1083, 1084, 1085, 1087,
  1089, 1092, 1093, 2002, 2003, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008,
  3009, 3011,
]);

// Consolidated scalar state
export const S = {
  cardCount: 0,
  globalCardIdCounter: 0,
  viewerIndex: -1,
  totalFiles: 0,
  processedCount: 0,
  downloadFormat: "image/jpeg",
  // Per-card format overrides: { cardId: "image/png", ... }
  cardFormats: {},
  lastTarget: null,
};

// Mutable collections (kept as separate exports)
export const sharedFileIds = new Set();
export const successfulDecodes = [];
export const failedDecodes = [];
