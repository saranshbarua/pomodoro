/**
 * Encapsulates communication with the native Swift layer.
 */
export interface ActivityProvenance {
  origin?: 'timer' | 'manual' | 'agent';
  durationSource?: 'observed' | 'user_supplied' | 'inferred';
  createdAt?: number;
  startedAt?: number;
  endedAt?: number;
  proposalId?: string;
}

export interface AgentAccessSettings {
  enabled: boolean;
  readFocusData: boolean;
  allowProposals: boolean;
  /** Privacy step completed at least once for this consent generation. */
  privacyAcknowledged?: boolean;
  /** Bumped when consent copy materially changes and must be re-shown. */
  consentVersion?: number;
  /** When true, skip the enable consent sheet on later turn-ons. */
  skipConsentPrompt?: boolean;
}

export const NativeBridge = {
  /**
   * Sends a message to the native Swift layer.
   */
  postMessage(action: string, payload: any = {}) {
    // Check if running in WKWebView
    if ((window as any).webkit && (window as any).webkit.messageHandlers && (window as any).webkit.messageHandlers.native) {
      (window as any).webkit.messageHandlers.native.postMessage({
        action,
        ...payload
      });
    } else {
      console.warn(`Native bridge not available for action: ${action}`, payload);
    }
  },

  /**
   * Updates the native menu bar title.
   */
  updateMenuBar(title: string) {
    this.postMessage('updateMenuBar', { title });
  },

  /**
   * Plays a native click sound.
   */
  playClickSound() {
    this.postMessage('playClickSound');
  },

  /**
   * Shows a native notification.
   */
  showNotification(title: string, body: string) {
    this.postMessage('showNotification', { title, body });
  },

  /**
   * Saves state to UserDefaults.
   */
  saveState(state: string) {
    this.postMessage('saveState', { state });
  },

  /**
   * Requests initial state from UserDefaults.
   */
  loadState() {
    this.postMessage('loadState');
  },

  /**
   * --- Database Actions ---
   */
  db_loadInitialData() {
    this.postMessage('db_loadInitialData');
  },

  db_addTask(id: string, title: string, estimatedPomos: number, tag?: string, projectId?: string) {
    this.postMessage('db_addTask', { id, title, estimatedPomos, tag, projectId });
  },

  db_updateTaskStatus(id: string, status: number) {
    this.postMessage('db_updateTaskStatus', { id, status });
  },

  db_deleteTask(id: string) {
    this.postMessage('db_deleteTask', { id });
  },

  db_clearCompletedTasks() {
    this.postMessage('db_clearCompletedTasks');
  },

  db_updateTask(id: string, title: string, estimatedPomos: number, tag?: string, projectId?: string) {
    this.postMessage('db_updateTask', { id, title, estimatedPomos, tag, projectId });
  },

  db_incrementPomos(id: string) {
    this.postMessage('db_incrementPomos', { id });
  },

  db_logActivity(duration: number, taskId: string | null, taskTitle: string | null, tag: string | null, isCompletion: boolean, projectId?: string | null, estimatedPomos: number = 1, snapshotFocusDuration: number = 1500, provenance?: ActivityProvenance) {
    this.postMessage('db_logActivity', {
      duration,
      taskId,
      taskTitle,
      tag,
      isCompletion,
      projectId,
      estimatedPomos,
      snapshotFocusDuration,
      provenance
    });
  },

  db_getReports() {
    this.postMessage('db_getReports');
  },

  db_getProjects() {
    this.postMessage('db_getProjects');
  },

  db_upsertProject(name: string, id?: string, color?: string) {
    this.postMessage('db_upsertProject', { name, id, color });
  },

  db_exportCSV() {
    this.postMessage('db_exportCSV');
  },

  /**
   * --- Agent Access ---
   *
   * Native may answer these requests through the corresponding
   * native:agentAccessSettings / native:agentConnectionStatus events.
   */
  getAgentAccessSettings() {
    this.postMessage('getAgentAccessSettings');
  },

  setAgentAccessSettings(settings: Partial<AgentAccessSettings>) {
    this.postMessage('setAgentAccessSettings', { settings });
  },

  getAgentConnectionStatus() {
    this.postMessage('getAgentConnectionStatus');
  },

  addToCursor() {
    this.postMessage('agentAddToCursor');
  },

  copyAgentConfiguration() {
    this.postMessage('agentCopyConfiguration');
  },

  copyAgentServerCommand() {
    this.postMessage('agentCopyServerCommand');
  },

  openAgentSetupGuide() {
    this.postMessage('agentOpenSetupGuide');
  },

  testAgentConnection() {
    this.postMessage('agentTestConnection');
  },

  disconnectAgentSessions() {
    this.postMessage('agentDisconnectSessions');
  },

  getAgentConnectionDetails() {
    this.postMessage('getAgentConnectionDetails');
  },

  retryAgentAccess() {
    this.postMessage('retryAgentAccess');
  },

  getPendingAgentProposals() {
    this.postMessage('getPendingAgentProposals');
  },

  agentProposalResult(requestId: string, approved: boolean, reason?: 'user_declined' | 'expired') {
    this.postMessage('agentProposalResult', { requestId, approved, reason });
  },

  agentCommandResult(requestId: string, result: unknown) {
    this.postMessage('agentCommandResult', { requestId, result });
  },

  /**
   * Hides the native popup window.
   */
  hideWindow() {
    this.postMessage('hideWindow');
  },

  /**
   * Force hides the native popup window (even if pinned).
   */
  forceHideWindow() {
    this.postMessage('forceHideWindow');
  },

  /**
   * Terminates the native application.
   */
  quitApp() {
    this.postMessage('quitApp');
  },

  /**
   * Triggers the Sparkle check-for-updates flow (same as the menu bar item).
   */
  checkForUpdates() {
    this.postMessage('checkForUpdates');
  },

  /**
   * Sets the window pinned state.
   * When pinned, the window stays visible even when clicking outside.
   */
  setPinned(pinned: boolean) {
    this.postMessage('setPinned', { pinned });
  },

  /**
   * Toggles the window pinned state.
   */
  togglePinned() {
    this.postMessage('togglePinned');
  },

  /**
   * Requests the current pinned state from native.
   */
  getPinnedState() {
    this.postMessage('getPinnedState');
  },

  /**
   * Begins dragging the pinned window (native global mouse tracking).
   */
  beginWindowDrag() {
    this.postMessage('beginWindowDrag');
  },

  /**
   * Tells the native app to start an activity to prevent App Nap.
   */
  startTimerActivity() {
    this.postMessage('startTimerActivity');
  },

  /**
   * Tells the native app to end the activity.
   */
  endTimerActivity() {
    this.postMessage('endTimerActivity');
  },

  /**
   * Starts a native countdown timer in the menu bar.
   * @param endTime - The target completion timestamp in milliseconds.
   */
  startNativeTimer(endTime: number) {
    this.postMessage('startNativeTimer', { endTime });
  },

  /**
   * Stops the native countdown timer.
   */
  stopNativeTimer() {
    this.postMessage('stopNativeTimer');
  }
};

/**
 * Global listener for messages from Swift.
 */
(window as any).receiveNativeMessage = (payload: { action: string, data: any }) => {
  try {
    const event = new CustomEvent(`native:${payload.action}`, { detail: payload.data });
    window.dispatchEvent(event);
  } catch (error) {
    console.error(`NativeBridge: Error processing message ${payload.action}:`, error);
  }
};

