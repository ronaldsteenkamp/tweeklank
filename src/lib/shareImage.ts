// Een overzicht als afbeelding delen (iOS en Android). De webversie gebruikt shareImage.web.ts.
import * as Sharing from 'expo-sharing';
import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export const CAN_SHARE_IMAGE = true;

export async function shareViewAsImage(ref: RefObject<ComponentRef<typeof View> | null>): Promise<void> {
  if (!ref.current) return;
  // tmpfile: de afbeelding staat alleen tijdelijk op het toestel, nooit op een server
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Ons jaar delen' });
}
