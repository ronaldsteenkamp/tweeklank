// Thuisschermwidget voor Android (expo-widgets met Jetpack Compose). De functie met de 'widget'-directive
// wordt als tekst opgeslagen en in de widget uitgevoerd, met de Compose-componenten van @expo/ui als
// globals. Hij leest alleen de props die de app met updateSnapshot opslaat; geen eigen netwerkverzoek.
import { Column, Text } from '@expo/ui/jetpack-compose';
import { createWidget } from 'expo-widgets';
import { EMPTY_WIDGET, type WidgetProps } from '@/lib/widgetData';
import type { HomeWidget } from './TweeklankWidget';

export function createTweeklankWidget(): HomeWidget {
  return createWidget<WidgetProps>(
    'Tweeklank',
    (props: WidgetProps) => {
      'widget';
      return (
        <Column>
          <Text style={{ typography: 'titleSmall' }}>{props.status}</Text>
          {props.partnerLine ? <Text>{props.partnerLine}</Text> : null}
          {props.question ? <Text maxLines={3}>{props.question}</Text> : null}
          {props.countdown ? <Text>{props.countdown}</Text> : null}
        </Column>
      );
    },
    EMPTY_WIDGET,
  );
}
