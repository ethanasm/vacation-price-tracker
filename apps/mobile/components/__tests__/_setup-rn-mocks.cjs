/**
 * Test-only stub for `react-native` (and a couple of native-only modules
 * the components touch). Loaded as the first thing in each component
 * test via `require()` so the React Native package — which can't be
 * loaded under plain Node — is replaced before the component's own
 * import chain resolves it.
 *
 * The stubs are minimal but real React components: react-test-renderer
 * sees them as host elements and we can introspect props off the tree.
 */

/* eslint-disable no-undef */
const Module = require('module');
const path = require('path');
const React = require('react');

// Tell React this is a valid act() environment so TestRenderer.act() doesn't
// warn "The current testing environment is not configured to support act(...)".
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const STUB_DIR = __dirname;
const RN_STUB = path.join(STUB_DIR, '_rn-stub.cjs');
const ICON_STUB = path.join(STUB_DIR, '_icons-stub.cjs');
const SAFE_AREA_STUB = path.join(STUB_DIR, '_safe-area-stub.cjs');
const SVG_STUB = path.join(STUB_DIR, '_svg-stub.cjs');
const LINEAR_GRADIENT_STUB = path.join(STUB_DIR, '_linear-gradient-stub.cjs');

const REPLACEMENTS = new Map([
  ['react-native', RN_STUB],
  ['lucide-react-native', ICON_STUB],
  ['react-native-safe-area-context', SAFE_AREA_STUB],
  ['react-native-svg', SVG_STUB],
  ['expo-linear-gradient', LINEAR_GRADIENT_STUB],
]);

const origResolve = Module._resolveFilename;
Module._resolveFilename = function patched(request, parent, ...rest) {
  const target = REPLACEMENTS.get(request);
  if (target) return target;
  return origResolve.call(this, request, parent, ...rest);
};

// Sanity: make sure React is reachable under the stubs so component
// tests don't need to import it themselves before the stubs run.
module.exports = { React };
