# Material Design 3 Theming

This project uses React Native Paper v5 to implement Material Design 3 theming throughout the application.

## Theme Configuration

The main theme configuration is located in `/constants/themes/paperTheme.ts`. This file extends the default Material Design 3 light theme with custom colors that match the app's branding.

### Color Palette

- **Primary**: `#FF6B35` (Orange) - Used for main actions and branding
- **Secondary**: `#007AFF` (Blue) - Used for secondary actions and accents  
- **Tertiary**: `#4CAF50` (Green) - Used for success states and positive actions
- **Error**: `#BA1A1A` (Red) - Used for error states and destructive actions

### Theme Structure

The theme follows Material Design 3 color roles:

```typescript
{
  primary: '#FF6B35',           // Main brand color
  onPrimary: '#FFFFFF',         // Text/icons on primary
  primaryContainer: '#FFE4D6',  // Container using primary color
  onPrimaryContainer: '#5C1A00', // Text/icons on primary container
  // ... similar structure for secondary, tertiary, error, surface, etc.
}
```

## Usage in Components

### Using Theme in Components

Components can access the theme using the `useTheme` hook from React Native Paper:

```typescript
import { useTheme } from 'react-native-paper';

export default function MyComponent() {
  const theme = useTheme();
  
  return (
    <View style={{ backgroundColor: theme.colors.surface }}>
      <Text style={{ color: theme.colors.onSurface }}>
        Hello World
      </Text>
    </View>
  );
}
```

### Paper Components Used

The app has been updated to use the following React Native Paper components:

- **Surface**: Replaces basic `View` for elevated surfaces
- **Button**: Material Design buttons with proper theming
- **TextInput**: Material Design text inputs with outline style
- **Card**: For message containers with elevation
- **Text**: Typography that follows Material Design text scales
- **Snackbar**: Replaces `ToastAndroid` for consistent cross-platform notifications
- **FAB**: Floating Action Button for primary actions

### Component Examples

#### ChatWindow Updates

The `ChatWindow` component now uses:
- `Surface` for the main container with proper elevation
- Modern message cards with `Surface` components and accent stripes
- `TextInput` with Material Design styling and rounded appearance
- `FAB` for the send button with dynamic styling
- `Button` for the main "I am on the cruise" action
- `Snackbar` for error notifications

#### Index Screen Updates

The main screen now uses:
- `Surface` as the root container
- `useTheme` hook to access theme colors
- `Snackbar` instead of `ToastAndroid` for notifications with proper theming

#### Bottom Navigation Updates

The tab navigation now uses Material Design 3 styling:
- **Material Icons**: Switched from FontAwesome to Material Icons for consistency
- **Theme Integration**: Tab colors use `theme.colors.primary` and `theme.colors.onSurfaceVariant`
- **Proper Elevation**: Bottom navigation has Material Design 3 elevation and shadows
- **Surface Styling**: Headers and tab bar use theme surface colors
- **Typography**: Material Design font weights and sizes

#### Settings Screen Updates

The settings screen has been completely redesigned with:
- `Card` components for grouped settings sections
- `Surface` containers with proper elevation
- Material Design `TextInput` with outline mode
- `Button` components with proper Material Design styling
- Visual status indicators using theme colors
- `Divider` components for content separation
- Comprehensive `Snackbar` notifications
- **Scrollable Layout**: Full screen scrollability for all content

## Customization

To customize the theme:

1. Edit `/constants/themes/paperTheme.ts`
2. Update color values following Material Design 3 color roles
3. The theme automatically applies to all Paper components

### Adding New Colors

You can extend the theme with custom colors:

```typescript
export const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    // Your custom colors
    messageBackground: '#F5F5F5',
    messageBorder: '#E0E0E0',
    timestampText: '#757575',
  },
};
```

## Provider Setup

The theme is configured in `/app/_layout.tsx`:

```typescript
import { paperTheme } from "@/constants/themes/paperTheme";

function RootLayoutNav() {
  return (
    <PaperProvider theme={paperTheme}>
      <ThemeProvider value={navigationTheme}>
        {/* Navigation and app content */}
      </ThemeProvider>
    </PaperProvider>
  );
}
```

## Benefits

1. **Consistency**: All components follow Material Design 3 principles
2. **Accessibility**: Better contrast ratios and touch targets
3. **Theming**: Centralized color management
4. **Cross-platform**: Consistent look across Android and iOS
5. **Maintainability**: Easy to update colors and styling globally
6. **Modern UI**: Contemporary chat interface with rounded inputs and FAB buttons
7. **Better UX**: Proper elevation hierarchy and visual feedback

## Migration Notes

The following components were replaced:
- `View` → `Surface` (where elevation is needed)
- `TouchableOpacity` → `Button` or `FAB`
- `TextInput` → `TextInput` from Paper (with modern styling)
- `ToastAndroid` → `Snackbar` (cross-platform)
- Custom styled containers → `Card` components
- `FontAwesome` icons → `MaterialIcons` for navigation
- Custom tab styling → Material Design 3 tab bar theming
- Hardcoded colors → Theme-based color system

All styling now uses theme colors instead of hardcoded values, making the app more maintainable and consistent with Material Design guidelines.

## Navigation Features

### Bottom Navigation Bar
- **Material Design 3 Styling**: Proper elevation, shadows, and surface colors
- **Icon Integration**: Material Icons that align with MD3 principles
- **Theme Colors**: Active/inactive states use primary and surface variant colors
- **Proper Typography**: Material Design text scales for labels
- **Responsive Design**: Proper padding and sizing for touch targets
- **Enhanced Spacing**: Added bottom padding for better visual balance

### Tab Screens
- **Consistent Headers**: All screens use themed headers with proper elevation
- **Material Components**: Settings screen showcases comprehensive Paper component usage
- **Status Indicators**: Visual feedback using theme colors for connection status
- **Grouped Content**: Card-based layout for logical content grouping
- **Scrollable Content**: All screens support scrolling for various screen sizes

## Chat Interface Improvements

### Modern Input Design
- **Rounded TextInput**: Pill-shaped input field with no visible borders
- **Dynamic FAB**: Smart send button that changes based on input state
- **Proper Spacing**: Improved padding and margins for better touch targets
- **Centered Placeholder**: Better visual balance in the input field
- **Elevated Container**: Input area uses proper Material Design elevation

### Enhanced Messages
- **Modern Cards**: Messages use Surface components with accent stripes
- **Better Typography**: Material Design text variants throughout
- **Theme Integration**: All colors come from the centralized theme
- **Improved Layout**: Better spacing and hierarchy for readability