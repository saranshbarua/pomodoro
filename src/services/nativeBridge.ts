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

