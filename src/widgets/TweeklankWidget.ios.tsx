// Thuisschermwidget voor iOS (WidgetKit via expo-widgets). De functie met de 'widget'-directive wordt
// door babel-preset-expo als tekst opgeslagen en in de widget zelf uitgevoerd, met de SwiftUI-componenten
// van @expo/ui als globals. Hij leest alleen de props die de app met updateSnapshot doorgeeft (via de
// gedeelde app-groep); de widget doet zelf geen netwerkverzoek.
import { Text, VStack } from '@expo/ui/swift-ui';
import { createWidget } from 'expo-widgets';
import { EMPTY_WIDGET, type WidgetProps } from '@/lib/widgetData';
import type { HomeWidget } from './TweeklankWidget';

export function createTweeklankWidget(): HomeWidget {
  return createWidget<WidgetProps>(
    'Tweeklank',
    (props: WidgetProps) => {
      'widget';
      return (
        <VStack alignment="leading" spacing={4}>
          <Text>{props.status}</Text>
          {props.partnerLine ? <Text>{props.partnerLine}</Text> : null}
          {props.question ? <Text>{props.question}</Text> : null}
          {props.countdown ? <Text>{props.countdown}</Text> : null}
        </VStack>
      );
    },
    EMPTY_WIDGET,
  );
}
