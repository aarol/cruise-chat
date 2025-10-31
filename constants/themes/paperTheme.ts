import { MD3LightTheme } from 'react-native-paper';

export const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    // Primary colors (main brand color)
    primary: '#FF6B35',
    onPrimary: '#FFFFFF',
    primaryContainer: '#FFE4D6',
    onPrimaryContainer: '#5C1A00',

    // Secondary colors (complementary)
    secondary: '#007AFF',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#E3F2FD',
    onSecondaryContainer: '#001D36',

    // Tertiary colors (accent)
    tertiary: '#4CAF50',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#E8F5E8',
    onTertiaryContainer: '#0F5132',

    // Error colors
    error: '#BA1A1A',
    onError: '#FFFFFF',
    errorContainer: '#FFDAD6',
    onErrorContainer: '#410002',

    // Surface colors
    surface: '#FFFBFF',
    onSurface: '#1C1B1F',
    surfaceVariant: '#F2F0F4',
    onSurfaceVariant: '#49454F',

    // Background colors
    background: '#FFFBFF',
    onBackground: '#1C1B1F',

    // Outline colors
    outline: '#79747E',
    outlineVariant: '#CAC4D0',

    // Chat-specific colors
    messageBackground: '#F5F5F5',
    messageBorder: '#E0E0E0',
    timestampText: '#757575',
  },
};

export type AppTheme = typeof paperTheme;
