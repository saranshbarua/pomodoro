/**
 * Service for native OS notifications.
 * Currently disabled to avoid runtime issues.
 */
export const NotificationService = {
  /**
   * No-op implementation
   */
  async notify(_title: string, _body: string) {
    // Notifications disabled
  },

  /**
   * No-op implementation
   */
  async notifySessionComplete(_type: 'focus' | 'shortBreak' | 'longBreak') {
    // Notifications disabled
  }
};
