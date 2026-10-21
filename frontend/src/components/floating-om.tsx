// Animated floating Om (ॐ) symbol used as a sacred ambient background.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors, fonts } from "@/src/theme";

type FloatingOmProps = { count?: number };

export function FloatingOm({ count = 5 }: FloatingOmProps) {
  const items = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        key: i,
        left: 10 + ((i * 73) % 80),
        size: 90 + ((i * 37) % 90),
        duration: 9000 + ((i * 1700) % 7000),
        delay: (i * 1500) % 6000,
        baseOpacity: 0.05 + ((i * 11) % 10) / 100,
      })),
    [count],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="floating-om-background">
      {items.map(({ key, ...rest }) => (
        <SingleOm key={key} {...rest} />
      ))}
    </View>
  );
}

function SingleOm({
  left,
  size,
  duration,
  delay,
  baseOpacity,
}: {
  left: number;
  size: number;
  duration: number;
  delay: number;
  baseOpacity: number;
}) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(baseOpacity);

  React.useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-120, { duration, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(baseOpacity + 0.08, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [translateY, opacity, delay, duration, baseOpacity]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.om, { left: `${left}%`, top: `${((left * 7) % 70) + 10}%` }, style]}>
      <Text style={[styles.omText, { fontSize: size }]} selectable={false}>
        ॐ
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  om: { position: "absolute" },
  omText: {
    color: colors.brandSecondary,
    fontFamily: fonts.display,
    textShadowColor: "rgba(252, 211, 77, 0.4)",
    textShadowRadius: 20,
  },
});
