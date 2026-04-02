// Delivery module re-exports.
// Provides markdown rendering, state tracking, recommendation rotation,
// notification signaling, and auto-apply for high-confidence settings changes.

export { renderRecommendations } from './renderer.js';
export { loadState, saveState, updateStatus, getStatusMap } from './state.js';
export { rotateRecommendations } from './rotator.js';
export {
  buildNotification,
  writeNotificationFlag,
  hasNotificationFlag,
  clearNotificationFlag,
  readNotificationFlagCount,
} from './notification.js';
export { autoApplyRecommendations } from './auto-apply.js';
