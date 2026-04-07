/**
 * Expo config plugin that adds KSP and kotlin-serialization
 * classpath dependencies to the root Android build.gradle,
 * and restricts ABI to arm64-v8a for device builds.
 *
 * This ensures `expo prebuild --clean` preserves these dependencies.
 */
const {
  withProjectBuildGradle,
  withAppBuildGradle,
  withGradleProperties,
} = require('expo/config-plugins');

function withKspPlugin(config) {
  // Add KSP + serialization classpath to root build.gradle
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let contents = config.modResults.contents;

      if (!contents.includes('com.google.devtools.ksp')) {
        contents = contents.replace(
          "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')",
          "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')\n    classpath('com.google.devtools.ksp:com.google.devtools.ksp.gradle.plugin:2.1.20-2.0.1')\n    classpath('org.jetbrains.kotlin:kotlin-serialization:2.1.20')"
        );
      }

      config.modResults.contents = contents;
    }
    return config;
  });

  // Restrict to arm64-v8a architecture via gradle.properties
  config = withGradleProperties(config, (config) => {
    const props = config.modResults;
    const archProp = props.find(
      (p) => p.type === 'property' && p.key === 'reactNativeArchitectures'
    );
    if (archProp) {
      archProp.value = 'arm64-v8a';
    }
    return config;
  });

  return config;
}

module.exports = withKspPlugin;
