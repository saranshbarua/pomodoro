/**
 * Encapsulates communication with the native Swift layer.
 */
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

  db_incrementPomos(id: string) {
    this.postMessage('db_incrementPomos', { id });
  },

  db_logActivity(duration: number, taskId: string | null, taskTitle: string | null, tag: string | null, isCompletion: boolean, projectId?: string | null) {
    this.postMessage('db_logActivity', { duration, taskId, taskTitle, tag, isCompletion, projectId });
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

  /**
   * Hides the native popup window.
   */
  hideWindow() {
    this.postMessage('hideWindow');
  },

  /**
   * Terminates the native application.
   */
  quitApp() {
    this.postMessage('quitApp');
  }
};

/**
 * Global listener for messages from Swift.
 */
(window as any).receiveNativeMessage = (payload: { action: string, data: any }) => {
  const event = new CustomEvent(`native:${payload.action}`, { detail: payload.data });
  window.dispatchEvent(event);
};

