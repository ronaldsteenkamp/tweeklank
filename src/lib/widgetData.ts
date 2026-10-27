// Wat de thuisschermwidget toont. Nooit de tekst van een antwoord; de vraag alleen als je dat zelf
// aanzet (standaard uit). Getest in __tests__/widgetData.test.ts

export type WidgetProps = {
  /** "Vraag van vandaag staat klaar" of "Jullie hebben allebei geantwoord" */
  status: string;
  /** "[naam] heeft geantwoord", of leeg */
  partnerLine: string;
  /** "Nog 12 dagen tot jullie elkaar weer zien", of leeg */
  countdown: string;
  /** de vraag zelf, alleen als je dat aanzet */
  question: string;
};

export const EMPTY_WIDGET: WidgetProps = { status: 'Open Tweeklank', partnerLine: '', countdown: '', question: '' };

export function widgetProps(params: {
  answered: boolean;
  partnerAnswered: boolean;
  partnerName: string;
  questionText: string;
  showQuestion: boolean;
  countdown?: string | null;
}): WidgetProps {
  const both = params.answered && params.partnerAnswered;
  return {
    status: both ? 'Jullie hebben allebei geantwoord' : 'Vraag van vandaag staat klaar',
    partnerLine: params.partnerAnswered && !both ? `${params.partnerName} heeft geantwoord` : '',
    countdown: params.countdown ?? '',
    question: params.showQuestion ? params.questionText : '',
  };
}
