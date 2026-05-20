export async function registerForPushNotifications(): Promise<string | null> {
  return null;
}

export function addForegroundListener(
  _onReceive: () => void,
  _onResponse: () => void,
): () => void {
  return () => {};
}
