// Basisconfiguratie staat in app.json. Hier zetten we alleen de thuisschermwidget aan, en alleen als
// TWEEKLANK_WIDGETS=1 is gezet (zie eas.json). Zo blijven `npx expo start`, Expo Go en de webversie
// precies zoals ze waren; de widget zit alleen in development- en store-builds.
const WIDGET_PLUGIN = [
  'expo-widgets',
  {
    enableAndroid: true,
    bundleIdentifier: 'nl.tweeklank.app.widget',
    groupIdentifier: 'group.nl.tweeklank.app',
    widgets: [
      {
        name: 'Tweeklank',
        displayName: 'Tweeklank',
        description: 'Zie of de vraag van vandaag klaarstaat. Zonder inhoud van antwoorden.',
        supportedFamilies: ['systemSmall', 'systemMedium'],
        android: { minWidth: 180, minHeight: 110, targetCellWidth: 3, targetCellHeight: 2, resizeMode: 'both' },
      },
    ],
  },
];

module.exports = ({ config }) => {
  if (process.env.TWEEKLANK_WIDGETS !== '1') return config;
  return { ...config, plugins: [...(config.plugins ?? []), WIDGET_PLUGIN] };
};
