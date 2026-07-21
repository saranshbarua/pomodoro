import { describe, expect, it } from 'vitest';
import {
  AGENT_ACCESS_CONSENT_VERSION,
  connectionDetailEntries,
  shouldShowAgentEnableConsent,
} from '../ui/agentAccessConsent';

describe('shouldShowAgentEnableConsent', () => {
  it('always shows for first-time users', () => {
    expect(shouldShowAgentEnableConsent({})).toBe(true);
    expect(shouldShowAgentEnableConsent({
      enabled: false,
      readFocusData: true,
      allowProposals: true,
    })).toBe(true);
  });

  it('shows again when privacy was acknowledged but user did not opt out', () => {
    expect(shouldShowAgentEnableConsent({
      privacyAcknowledged: true,
      consentVersion: AGENT_ACCESS_CONSENT_VERSION,
      skipConsentPrompt: false,
    })).toBe(true);
  });

  it('skips when user opted out after completing the privacy gate', () => {
    expect(shouldShowAgentEnableConsent({
      privacyAcknowledged: true,
      consentVersion: AGENT_ACCESS_CONSENT_VERSION,
      skipConsentPrompt: true,
    })).toBe(false);
  });

  it('re-shows after a consent version bump even if previously opted out', () => {
    expect(shouldShowAgentEnableConsent({
      privacyAcknowledged: true,
      consentVersion: AGENT_ACCESS_CONSENT_VERSION - 1,
      skipConsentPrompt: true,
    })).toBe(true);
  });

  it('does not skip from opt-out alone without a completed privacy gate', () => {
    expect(shouldShowAgentEnableConsent({
      skipConsentPrompt: true,
    })).toBe(true);
  });
});

describe('connectionDetailEntries', () => {
  it('surfaces only the helper path for Advanced support', () => {
    expect(connectionDetailEntries({
      transport: 'Local stdio',
      availability: 'While Flumen is open',
      enabled: true,
      helperPath: '/Applications/Flumen.app/Contents/Helpers/flumen-mcp',
      protocolVersion: 1,
      server: 'Flumen MCP',
      socketPath: '/tmp/flumen.sock',
    })).toEqual([
      {
        key: 'helperPath',
        label: 'Helper Path',
        value: '/Applications/Flumen.app/Contents/Helpers/flumen-mcp',
      },
    ]);
  });
});
