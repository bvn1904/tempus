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

   // --- CHECK A: Native Update (GitHub) ---
    // We wrap this in its OWN try/catch so it doesn't kill the app update
    try {
        const response = await fetch(NATIVE_VERSION_URL);
        // Only parse if the response is actually OK (200)
        if (response.ok) {
            const remoteData = await response.json();
            const currentVersion = Constants.expoConfig.version;
            
            if (compareVersions(remoteData.version, currentVersion) > 0) {
                showNativeUpdateAlert(remoteData.downloadUrl);
                return; // Priority: If native update exists, stop here.
            }
        } else {
            console.log("GitHub version check skipped (404 or Private Repo)");
        }
    } catch (e) {
        console.log("Native check failed (ignoring):", e);
    }

    // --- CHECK B: OTA Update (Expo) ---
    // This now runs even if GitHub fails
    try {
        if (!__DEV__) { 
            const update = await Updates.checkForUpdateAsync();
            if (update.isAvailable) {
                showOTAUpdateAlert();
            } else {
                // Optional: Uncomment for debugging
                Alert.alert("No Update", "You have the latest version."); 
            }
        }
    } catch (e) {
        console.log("OTA update check failed:", e);
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
