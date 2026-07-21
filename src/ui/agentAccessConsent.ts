import { AgentAccessSettings } from '../services/nativeBridge';

/** Current privacy/consent generation. Bump when consent copy must be re-shown. */
export const AGENT_ACCESS_CONSENT_VERSION = 1;

/** Keys hidden from Advanced — setup status already covers these. */
export const CONNECTION_DETAIL_HIDDEN_KEYS = new Set([
  'transport',
  'availability',
  'enabled',
  'server',
  'socketPath',
  'protocolVersion',
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

/** Advanced support fields only (helper path). */
export function connectionDetailEntries(
  details: Record<string, unknown>,
): Array<{ key: string; label: string; value: string }> {
  const labelFor = (key: string) => {
    switch (key) {
      case 'helperPath':
        return 'Helper Path';
      default:
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    }
  };

  return Object.entries(details)
    .filter(([key, value]) => {
      if (CONNECTION_DETAIL_HIDDEN_KEYS.has(key)) return false;
      // Advanced surfaces the helper path for support / manual MCP setup only.
      if (key !== 'helperPath') return false;
      return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    })
    .map(([key, value]) => ({
      key,
      label: labelFor(key),
      value: String(value),
    }));
}
