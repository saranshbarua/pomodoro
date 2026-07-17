import { AgentAccessSettings } from '../services/nativeBridge';

/** Current privacy/consent generation. Bump when consent copy must be re-shown. */
export const AGENT_ACCESS_CONSENT_VERSION = 1;

/** Keys already shown as static Connection Details rows; omit from the dynamic dump. */
export const CONNECTION_DETAIL_STATIC_KEYS = new Set([
  'transport',
  'availability',
  'enabled',
]);

/**
 * Show the enable consent sheet unless the user opted out after a completed privacy gate.
 * First-time users never have skipConsentPrompt, so they always see consent.
 * A consentVersion bump re-shows the sheet even if they previously opted out.
 */
export function shouldShowAgentEnableConsent(settings: Partial<AgentAccessSettings>): boolean {
  const optedOut = settings.skipConsentPrompt === true;
  const hasCurrentConsent =
    settings.privacyAcknowledged === true
    && typeof settings.consentVersion === 'number'
    && settings.consentVersion >= AGENT_ACCESS_CONSENT_VERSION;

  return !(optedOut && hasCurrentConsent);
}

export function connectionDetailEntries(
  details: Record<string, unknown>,
): Array<{ key: string; label: string; value: string }> {
  const labelFor = (key: string) => {
    switch (key) {
      case 'helperPath':
        return 'Helper Path';
      case 'socketPath':
        return 'Socket Path';
      case 'protocolVersion':
        return 'Protocol';
      case 'server':
        return 'Server';
      default:
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    }
  };

  return Object.entries(details)
    .filter(([key, value]) => !CONNECTION_DETAIL_STATIC_KEYS.has(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
    .map(([key, value]) => ({
      key,
      label: labelFor(key),
      value: String(value),
    }));
}
