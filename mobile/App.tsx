import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18n, { loadStoredLanguage } from './src/i18n';
import { HomeScreen } from './src/screens/Home';
import { PracticeScreen } from './src/screens/Practice';
import { JournalScreen } from './src/screens/Journal';
import { MirrorScreen } from './src/screens/Mirror';
import { SettingsScreen } from './src/screens/Settings';
import { PauseScreen } from './src/screens/Pause';
import { DebriefScreen } from './src/screens/Debrief';
import { LanguageGate } from './src/components/LanguageGate';
import { seedDemo } from './src/storage';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ICONS: Record<string, string> = {
  Home: '🪔',
  Practice: '🎯',
  Journal: '📖',
  Mirror: '🪞',
  Settings: '⚙',
};

function Tabs() {
  const { t } = useTranslation();
  const labels: Record<string, string> = {
    Home: t('nav.home'),
    Practice: t('nav.practice'),
    Journal: t('nav.journal'),
    Mirror: t('nav.mirror'),
    Settings: t('nav.more'),
  };
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.abyss, borderTopColor: colors.saffron + '33', height: 64, paddingBottom: 10, paddingTop: 6 },
        tabBarActiveTintColor: colors.saffron,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{ICONS[route.name]}</Text>
        ),
        tabBarLabel: labels[route.name] ?? route.name,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Practice" component={PracticeScreen} />
      <Tab.Screen name="Journal" component={JournalScreen} />
      <Tab.Screen name="Mirror" component={MirrorScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.night, card: colors.abyss, text: colors.cream, border: colors.line },
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [hasLang, setHasLang] = useState(false);

  useEffect(() => {
    (async () => {
      const code = await loadStoredLanguage();
      await i18n.changeLanguage(code);
      try {
        const seen = await AsyncStorage.getItem('ruko.lang.seen');
        setHasLang(!!seen);
      } catch (_) {}
      await seedDemo();
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.saffron, fontSize: 40, fontWeight: '900' }}>रु</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!hasLang) {
    return (
      <SafeAreaProvider>
        <LanguageGate
          onDone={() => {
            AsyncStorage.setItem('ruko.lang.seen', '1').catch(() => {});
            setHasLang(true);
          }}
        />
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }}>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="Pause" component={PauseScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="Debrief" component={DebriefScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
