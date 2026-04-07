import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

const Colors = {
  light: {
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
  },
  dark: {
    background: '#000000',
    backgroundElement: '#212225',
  },
};

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  colorScheme?: 'light' | 'dark';
}

export const Card: React.FC<CardProps> = React.memo(({ children, style, colorScheme = 'light' }) => {
  const theme = Colors[colorScheme];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement },
        style,
      ]}
    >
      {children}
    </View>
  );
});

Card.displayName = 'Card';

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
});
