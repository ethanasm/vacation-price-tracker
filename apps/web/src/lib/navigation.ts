export function redirectTo(url: string): void {
  globalThis.location.assign(url);
}
