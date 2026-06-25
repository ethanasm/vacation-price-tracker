/**
 * expo-linear-gradient stub: renders as rn-view so tests can assert on
 * the gradient wrapping container without native rendering.
 */

const React = require('react');

function LinearGradient(props) {
  return React.createElement('rn-view', { colors: props.colors, style: props.style }, props.children);
}

module.exports = {
  __esModule: true,
  default: LinearGradient,
  LinearGradient,
};
