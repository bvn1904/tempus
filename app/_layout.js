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
          contentStyle: { backgroundColor: isDark ? '#000000' : '#F5F5F7' },
          animation: 'default', 
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen 
          name="add" 
          options={{ 
            presentation: 'card', 
            animationDuration: 250 
          }} 
        />
      </Stack>
    </>
  );
}
