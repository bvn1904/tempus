import { useEffect, useState } from 'react';
import { Alert, Platform, BackHandler, Linking } from 'react-native';
import * as Updates from 'expo-updates';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const NATIVE_VERSION_URL = 'https://raw.githubusercontent.com/bvn1904/tempus/main/version.json';

export default function UpdateManager() {
  useEffect(() => {
    checkUpdates();
  }, []);

  const checkUpdates = async () => {
    // 1. Check if user clicked "Later" within the last 24 hours
    const lastPromptStr = await SecureStore.getItemAsync('lastUpdatePrompt');
    if (lastPromptStr) {
        const lastPrompt = parseInt(lastPromptStr, 10);
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (Date.now() - lastPrompt < twentyFourHours) {
            console.log("Update snoozed for 24h");
            return;
        }
    }

    try {
        // --- STEP A: Check for Native Update (New APK) ---
        // Fetch version.json from GitHub
        const response = await fetch(NATIVE_VERSION_URL);
        const remoteData = await response.json();
        
        // Compare current app version (from app.json) with GitHub version
        const currentVersion = Constants.expoConfig.version;
        
        if (compareVersions(remoteData.version, currentVersion) > 0) {
            showNativeUpdateAlert(remoteData.downloadUrl);
            return; // Stop here if native update is needed (priority)
        }

        // --- STEP B: Check for OTA Update (JS Changes) ---
        if (!__DEV__) { // Only check in production/preview
            const update = await Updates.checkForUpdateAsync();
            if (update.isAvailable) {
                showOTAUpdateAlert();
            }
        }
    } catch (e) {
        console.log("Update check failed:", e);
    }
  };

  const showNativeUpdateAlert = (url) => {
    Alert.alert(
      "New App Version",
      "A new version of Tempus is available. Please download the new APK.",
      [
        { text: "Later", onPress: () => snoozeUpdate(), style: "cancel" },
        { text: "Download", onPress: () => Linking.openURL(url) }
      ]
    );
  };

  const showOTAUpdateAlert = () => {
    Alert.alert(
      "Update Available",
      "A new update is available. Download now?",
      [
        { text: "Later", onPress: () => snoozeUpdate(), style: "cancel" },
        { 
          text: "OK", 
          onPress: async () => {
             // START DOWNLOADING
             try {
                 await Updates.fetchUpdateAsync();
                 // AFTER DOWNLOAD FINISHES:
                 Alert.alert(
                     "Update Ready",
                     "The app needs to restart to apply changes.",
                     [
                         { 
                             text: "Relaunch", 
                             onPress: async () => {
                                 await Updates.reloadAsync(); 
                                 // Note: reloadAsync() effectively restarts the app.
                                 // "Killing" the app (BackHandler.exitApp()) is bad UX on Android
                                 // and impossible on iOS. reloadAsync is the standard "Restart".
                             } 
                         }
                     ]
                 );
             } catch (e) {
                 Alert.alert("Error", "Failed to download update.");
             }
          }
        }
      ]
    );
  };

  const snoozeUpdate = async () => {
    await SecureStore.setItemAsync('lastUpdatePrompt', Date.now().toString());
  };

  // Helper to compare "1.0.0" vs "1.0.1"
  const compareVersions = (v1, v2) => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const val1 = parts1[i] || 0;
        const val2 = parts2[i] || 0;
        if (val1 > val2) return 1;
        if (val1 < val2) return -1;
    }
    return 0;
  };

  return null; // This component renders nothing
}
