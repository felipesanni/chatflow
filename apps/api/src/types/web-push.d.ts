declare module 'web-push' {
  export type PushSubscription = {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  };

  export type RequestDetails = {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    endpoint?: string;
  };

  export type SendResult = {
    statusCode?: number;
    headers?: Record<string, string>;
    body?: string;
  };

  export type VapidKeys = {
    publicKey: string;
    privateKey: string;
  };

  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  export function generateVAPIDKeys(): VapidKeys;
  export function sendNotification(
    subscription: PushSubscription,
    payload?: string,
    options?: RequestDetails,
  ): Promise<SendResult>;

  const webpush: {
    setVapidDetails: typeof setVapidDetails;
    generateVAPIDKeys: typeof generateVAPIDKeys;
    sendNotification: typeof sendNotification;
  };

  export default webpush;
}
