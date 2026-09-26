// Shared elevation presets. Cards across the app used flat 1.5px borders
// with no depth — these add a soft, consistent shadow on top of the
// existing border so surfaces read as "raised" instead of just outlined.
// Usage: style={[s.card, shadow.sm]}
import { Platform } from 'react-native';

function make(opacity, radius, elevation) {
  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: radius / 2.5 },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: { elevation },
    default: {},
  });
}

export const shadow = {
  xs: make(0.04, 4, 1),
  sm: make(0.06, 8, 3),
  md: make(0.08, 14, 6),
  lg: make(0.1, 22, 10),
};
