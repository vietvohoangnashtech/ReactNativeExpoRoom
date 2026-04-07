import React, { useCallback } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    textSecondary: '#B0B4BA',
  },
};

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  accessibilityLabel?: string;
  colorScheme?: 'light' | 'dark';
}

export const Input: React.FC<InputProps> = React.memo(
  ({
    label,
    value,
    onChangeText,
    placeholder,
    error,
    secureTextEntry = false,
    accessibilityLabel,
    colorScheme = 'light',
  }) => {
    const theme = Colors[colorScheme];

    const handleChangeText = useCallback(
      (text: string) => {
        onChangeText(text);
      },
      [onChangeText],
    );

    return (
      <View style={styles.container}>
        {label !== undefined && (
          <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
        )}
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundElement,
              color: theme.text,
              borderColor: error !== undefined ? '#EF4444' : 'transparent',
            },
          ]}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={secureTextEntry}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ selected: false }}
        />
        {error !== undefined && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  },
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 44,
    borderWidth: 1,
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#EF4444',
  },
});
