// Maakt het exportbestand op het toestel en opent het systeemdeelmenu. Er blijft geen kopie op een
// server; het tijdelijke bestand op het toestel wordt na het delen weer verwijderd.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export async function shareExportFile(name: string, content: string, mimeType: string): Promise<void> {
  if (Platform.OS === 'web') {
    // In de browser: gewoon downloaden
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(content);
  try {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Tweeklank-export delen' });
  } finally {
    file.delete();
  }
}
