/**
 * react-native-svg stub: SVG elements rendered as named host elements
 * so react-test-renderer can introspect them without native bindings.
 */

const React = require('react');

function svgHost(type) {
  return function SvgStub(props) {
    return React.createElement(type, props, props.children);
  };
}

module.exports = {
  __esModule: true,
  default: svgHost('svg-svg'),
  Svg: svgHost('svg-svg'),
  Path: svgHost('svg-path'),
  Line: svgHost('svg-line'),
  Circle: svgHost('svg-circle'),
  Defs: svgHost('svg-defs'),
  LinearGradient: svgHost('svg-lineargradient'),
  Stop: svgHost('svg-stop'),
  Rect: svgHost('svg-rect'),
  G: svgHost('svg-g'),
  Text: svgHost('svg-text'),
};
