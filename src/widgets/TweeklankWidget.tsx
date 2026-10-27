// Web en andere platforms: geen thuisschermwidget. Zie TweeklankWidget.ios.tsx en .android.tsx.
import type { WidgetProps } from '@/lib/widgetData';

export type HomeWidget = { updateSnapshot: (props: WidgetProps) => void };

export function createTweeklankWidget(): HomeWidget | null {
  return null;
}
