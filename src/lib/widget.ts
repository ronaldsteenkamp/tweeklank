// Brug naar de thuisschermwidget. Werkt alleen in een development- of store-build met expo-widgets;
// in Expo Go en in de browser bestaat de native module niet en doet dit niets.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { HomeWidget } from '@/widgets/TweeklankWidget';
import { EMPTY_WIDGET, type WidgetProps } from './widgetData';

const SHOW_QUESTION_KEY = 'tweeklank.widget.showQuestion';

let widget: HomeWidget | null | undefined;

/** Is er een thuisschermwidget op dit toestel (geen web, geen Expo Go)? */
export function widgetAvailable(): boolean {
  return Platform.OS !== 'web' && requireOptionalNativeModule('ExpoWidgets') !== null;
}

function getWidget(): HomeWidget | null {
  if (widget === undefined) {
    // pas laden als de native module er is: expo-widgets vraagt hem anders meteen op en faalt
    widget = widgetAvailable()
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- bewust lui laden, zie hierboven
        (require('@/widgets/TweeklankWidget') as typeof import('@/widgets/TweeklankWidget')).createTweeklankWidget()
      : null;
  }
  return widget;
}

export function updateHomeWidget(props: WidgetProps): void {
  try {
    getWidget()?.updateSnapshot(props);
  } catch {
    // een widget is een extraatje; de app moet altijd blijven werken
  }
}

/** Bij uitloggen of ontkoppelen: niets meer van jullie op het thuisscherm. */
export function clearHomeWidget(): void {
  updateHomeWidget(EMPTY_WIDGET);
}

/** Toon de vraag zelf in de widget? Alleen op dit toestel bewaard, standaard uit. */
export async function getWidgetShowsQuestion(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SHOW_QUESTION_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setWidgetShowsQuestion(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SHOW_QUESTION_KEY, on ? '1' : '0');
  } catch {
    // niet erg: dan blijft de standaard (uit) gelden
  }
}
