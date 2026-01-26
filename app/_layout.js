import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import UpdateManager from './components/UpdateManager';

export default function Layout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <>
      <UpdateManager />
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack 
        screenOptions={{ 
          headerShown: false,
          contentStyle: { backgroundColor: isDark ? '#000000' : '#F5F5F7' }
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
    </>
  );

  return (
    <Stack 
      screenOptions={{ 
        headerShown: false, // We use our own custom headers
        animation: 'default', // Uses native slide animations
        gestureEnabled: true, // Allows swiping back
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen 
        name="add" 
        options={{ 
          // 'card' makes it slide up/over like a standard new page
          presentation: 'card', 
          animationDuration: 250 
        }} 
      />
    </Stack>
  );
}
