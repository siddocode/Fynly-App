const fs = require('fs');
const path = require('path');

const candidates = [
  path.join(__dirname, '../node_modules/expo-notifications/build/TopicSubscriptionModule.android.js'),
  path.join(__dirname, '../node_modules/expo-notifications/src/TopicSubscriptionModule.android.ts'),
  path.join(__dirname, '../apps/mobile/node_modules/expo-notifications/build/TopicSubscriptionModule.android.js'),
  path.join(__dirname, '../apps/mobile/node_modules/expo-notifications/src/TopicSubscriptionModule.android.ts'),
];

let patchedCount = 0;

for (const filePath of candidates) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes("requireNativeModule('ExpoTopicSubscriptionModule')") ||
        content.includes("requireNativeModule<TopicSubscriptionModule>('ExpoTopicSubscriptionModule')")) {
      content = content
        .replace(/requireNativeModule\b/g, 'requireOptionalNativeModule');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[Patch] Successfully patched ${filePath} for Expo Go Android compatibility.`);
      patchedCount++;
    }
  }
}

if (patchedCount === 0) {
  console.log('[Patch] Expo Notifications already patched or not found.');
}
