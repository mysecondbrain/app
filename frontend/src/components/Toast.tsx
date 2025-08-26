import React, { useEffect } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export default function Toast({ visible, text }: { visible: boolean; text: string }) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [visible]);
  if (!visible && opacity.__getValue() === 0) return null as any;
  return (
    <Animated.View style={[styles.toast, { opacity }]} accessibilityRole="alert" accessibilityLabel={text}>
      <Text style={styles.text} allowFontScaling>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', bottom: 24, left: 16, right: 16, backgroundColor: '#222', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#333' },
  text: { color: '#fff', textAlign: 'center' },
});