// In de browser delen we geen afbeelding (react-native-view-shot heeft daar een extra bibliotheek nodig).
import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';

export const CAN_SHARE_IMAGE = false;

export async function shareViewAsImage(_ref: RefObject<ComponentRef<typeof View> | null>): Promise<void> {
  throw new Error('Delen als afbeelding kan alleen in de app.');
}
