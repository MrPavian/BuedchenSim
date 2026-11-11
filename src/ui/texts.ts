import type { InteractionAction } from '../game/interaction';

/** All player-visible strings live here (German). */
export const texts = {
  controls: {
    move: { keys: 'WASD / Pfeiltasten', label: 'Bewegen' },
    interact: { keys: 'E', label: 'Interagieren' },
  },
  interaction: {
    'door.open': 'Tür öffnen',
    'door.close': 'Tür schließen',
    'shutter.open': 'Verkaufsklappe öffnen',
    'shutter.close': 'Verkaufsklappe schließen',
  } satisfies Record<InteractionAction, string>,
  interactionKey: 'E',
  newGame: {
    button: 'Neues Spiel',
    confirm: 'Wirklich neu starten?',
    started: 'Neues Spiel gestartet',
  },
  notices: {
    loaded: 'Spielstand geladen',
    corrupt: 'Spielstand konnte nicht gelesen werden – neues Spiel gestartet',
    saveFailed: 'Speichern nicht möglich',
  },
  errors: {
    title: 'Das Büdchen kann nicht öffnen',
    generic: 'Beim Start oder im laufenden Spiel ist ein Fehler aufgetreten.',
    content: 'Die Spieldaten sind fehlerhaft und das Spiel wurde nicht gestartet.',
    webgl:
      'Dein Browser unterstützt WebGL nicht oder es ist deaktiviert. Bitte aktiviere die Hardwarebeschleunigung oder verwende einen aktuellen Browser.',
    reload: 'Seite neu laden',
    details: 'Technische Details',
  },
} as const;
