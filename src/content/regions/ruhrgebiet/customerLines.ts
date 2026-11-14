import type { CustomerLines } from '../../../game/types';

/**
 * Generic lines of the built-in customer conversation. The player's options (sell, checkId, decline, close) are what the
 * player says; sold/declined/idChecked/failed are what the resident answers. Resident-specific wishes live on the wishes.
 */
export const ruhrgebietCustomerLines: CustomerLines = {
  sell: 'Bitte sehr.',
  checkId: 'Ausweis, bitte.',
  decline: 'Das hab ich gerade nicht.',
  close: 'Bis gleich.',
  idChecked: 'Hier. {age} Jahre, steht alles drauf.',
  sold: 'Passt. Danke dir.',
  declined: 'Auch gut. Dann ein andermal.',
  failed: {
    insufficient_stock: 'So viel hast du davon nicht da? Dann lass lieber.',
    kiosk_closed: 'Die Klappe ist doch zu.',
    customer_underage: 'Okay, okay. War einen Versuch wert.',
    age_check_required: 'Du willst erst den Ausweis sehen. Klar, frag ruhig.',
    day_not_open: 'Für heute ist hier Schluss, was?',
  },
  failedFallback: 'Das klappt gerade nicht. Später noch mal?',
};
