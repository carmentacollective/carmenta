/**
 * Push Notifications Module
 *
 * PWA push notifications for Carmenta.
 * Used by AI agents and long-running jobs to notify users.
 */

export {
    sendPushNotification,
    isPushConfigured,
    type PushNotificationPayload,
    type SendPushParams,
    type SendPushResult,
} from "./notification-service";
