import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, useWindowDimensions } from 'react-native';
import Svg, { Line, Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';

interface NodeData {
  id: number;
  baseX: number;
  baseY: number;
  radius: number;
  color: string;
  isHub?: boolean;
}

export const ConstellationBackground: React.FC = () => {
  // Continuous floating drift animation values (never stopping, infinite organic motion)
  const driftAnim1 = useRef(new Animated.Value(0)).current;
  const driftAnim2 = useRef(new Animated.Value(0)).current;
  const driftAnim3 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // 1. Slow, continuous floating motion for constellation web
    const loop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(driftAnim1, {
          toValue: 1,
          duration: 10000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(driftAnim1, {
          toValue: 0,
          duration: 10000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // 2. Secondary drift for top ambient glow orb
    const loop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(driftAnim2, {
          toValue: 1,
          duration: 14000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(driftAnim2, {
          toValue: 0,
          duration: 14000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    // 3. Drift for bottom ambient glow orb
    const loop3 = Animated.loop(
      Animated.sequence([
        Animated.timing(driftAnim3, {
          toValue: 1,
          duration: 16000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(driftAnim3, {
          toValue: 0,
          duration: 16000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // 4. Subtle continuous breathing pulse for hub nodes (never dropping to 0)
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.65,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    loop1.start();
    loop2.start();
    loop3.start();
    pulseLoop.start();

    return () => {
      loop1.stop();
      loop2.stop();
      loop3.stop();
      pulseLoop.stop();
    };
  }, [driftAnim1, driftAnim2, driftAnim3, pulseAnim]);

  // Interpolated continuous parallax translations
  const translateX1 = driftAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [-18, 20],
  });
  const translateY1 = driftAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [14, -18],
  });

  const glowX1 = driftAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [-25, 25],
  });
  const glowY1 = driftAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [20, -25],
  });

  const glowX2 = driftAnim3.interpolate({
    inputRange: [0, 1],
    outputRange: [25, -20],
  });
  const glowY2 = driftAnim3.interpolate({
    inputRange: [0, 1],
    outputRange: [-15, 25],
  });

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const SCREEN_WIDTH = windowWidth || 380;
  const SCREEN_HEIGHT = windowHeight || 800;

  // XulIQ Constellation Palette for Dark Chalkboard Scene
  const primaryColor = '#ffffff'; // White stars
  const secondaryColor = '#e2e8f0'; // Subtle silvery white
  const accentColor = '#38bdf8'; // Soft sky blue beacon
  const lineColor = 'rgba(255, 255, 255, 0.28)';

  // Static distribution of constellation nodes relative to screen proportions
  const nodes: NodeData[] = [
    { id: 1, baseX: SCREEN_WIDTH * 0.12, baseY: SCREEN_HEIGHT * 0.14, radius: 5.5, color: primaryColor, isHub: true },
    { id: 2, baseX: SCREEN_WIDTH * 0.42, baseY: SCREEN_HEIGHT * 0.09, radius: 4, color: secondaryColor },
    { id: 3, baseX: SCREEN_WIDTH * 0.82, baseY: SCREEN_HEIGHT * 0.16, radius: 6, color: accentColor, isHub: true },
    { id: 4, baseX: SCREEN_WIDTH * 0.22, baseY: SCREEN_HEIGHT * 0.32, radius: 4, color: primaryColor },
    { id: 5, baseX: SCREEN_WIDTH * 0.88, baseY: SCREEN_HEIGHT * 0.36, radius: 5, color: secondaryColor },
    { id: 6, baseX: SCREEN_WIDTH * 0.09, baseY: SCREEN_HEIGHT * 0.58, radius: 4.5, color: primaryColor },
    { id: 7, baseX: SCREEN_WIDTH * 0.91, baseY: SCREEN_HEIGHT * 0.62, radius: 6, color: primaryColor, isHub: true },
    { id: 8, baseX: SCREEN_WIDTH * 0.18, baseY: SCREEN_HEIGHT * 0.78, radius: 5, color: accentColor },
    { id: 9, baseX: SCREEN_WIDTH * 0.48, baseY: SCREEN_HEIGHT * 0.88, radius: 4, color: secondaryColor },
    { id: 10, baseX: SCREEN_WIDTH * 0.80, baseY: SCREEN_HEIGHT * 0.84, radius: 5.5, color: primaryColor, isHub: true },
    { id: 11, baseX: SCREEN_WIDTH * 0.62, baseY: SCREEN_HEIGHT * 0.22, radius: 3.5, color: primaryColor },
    { id: 12, baseX: SCREEN_WIDTH * 0.35, baseY: SCREEN_HEIGHT * 0.68, radius: 4, color: secondaryColor },
  ];

  // Interconnecting constellation threads
  const edges = [
    [1, 2], [2, 11], [11, 3],
    [1, 4], [4, 6],
    [3, 5], [5, 7],
    [6, 8], [8, 12], [12, 9],
    [9, 10], [10, 7],
    [4, 12], [11, 5],
  ];

  return (
    <View style={styles.rootBackground} pointerEvents="none">
      {/* 1. Continuous Floating Ambient Background Glows */}
      <Animated.View
        style={[
          styles.ambientGlowTop,
          {
            transform: [{ translateX: glowX1 }, { translateY: glowY1 }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.ambientGlowBottom,
          {
            transform: [{ translateX: glowX2 }, { translateY: glowY2 }],
          },
        ]}
      />

      {/* 2. Constellation Lines & Star Nodes Layer with Continuous Parallax Drift */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ translateX: translateX1 }, { translateY: translateY1 }],
          },
        ]}
      >
        <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={primaryColor} stopOpacity="0.4" />
              <Stop offset="1" stopColor={secondaryColor} stopOpacity="0.4" />
            </LinearGradient>
          </Defs>

          {/* Interconnecting Dotted Web Lines */}
          {edges.map(([fromId, toId], idx) => {
            const from = nodes.find((n) => n.id === fromId);
            const to = nodes.find((n) => n.id === toId);
            if (!from || !to) return null;
            return (
              <Line
                key={`edge-${idx}`}
                x1={from.baseX}
                y1={from.baseY}
                x2={to.baseX}
                y2={to.baseY}
                stroke={lineColor}
                strokeWidth={1.4}
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Glowing Constellation Star Nodes */}
          {nodes.map((n) => (
            <G key={`node-svg-${n.id}`}>
              {/* Radar ring around Hub nodes */}
              {n.isHub && (
                <Circle
                  cx={n.baseX}
                  cy={n.baseY}
                  r={n.radius * 2.8}
                  stroke={n.color}
                  strokeWidth={1.2}
                  strokeDasharray="3 3"
                  fill="none"
                  opacity={0.5}
                />
              )}
              {/* Soft outer glow */}
              <Circle
                cx={n.baseX}
                cy={n.baseY}
                r={n.radius * 1.8}
                fill={n.color}
                opacity={0.18}
              />
              {/* Solid core */}
              <Circle
                cx={n.baseX}
                cy={n.baseY}
                r={n.radius}
                fill={n.color}
              />
              {/* Crisp white center beacon */}
              <Circle
                cx={n.baseX}
                cy={n.baseY}
                r={n.radius * 0.45}
                fill="#ffffff"
              />
            </G>
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  rootBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#11221f', // Deep dark chalkboard green matching XulIQ
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(217, 119, 6, 0.12)', // Warm desk ambient reflection
  },
});
