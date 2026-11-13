import type { CustomerLines } from '../../../game/types';

/** Generic lines of the built-in customer conversation (what the player says; the resident's wish text lives on the wish). */
export const ruhrgebietCustomerLines: CustomerLines = {
  sell: 'Gern, hier bitte.',
  checkId: 'Ausweis, bitte.',
  decline: 'Tut mir leid, das habe ich nicht.',
  close: 'Bis später.',
  idChecked: 'Na gut, bitte sehr. Ich bin {age}.',
  sold: 'Passt. Danke dir!',
  declined: 'Schade. Dann eben nicht.',
  failed: {
    insufficient_stock: 'Davon ist gerade nicht genug im Regal.',
    age_check_required: 'Erst mal einen Blick auf den Ausweis.',
    customer_underage: 'Das darf ich dir nicht verkaufen.',
    kiosk_closed: 'Die Klappe ist zu.',
    day_not_open: 'Der Laden ist schon dicht.',
  },
  failedFallback: 'Das klappt gerade nicht.',
};
