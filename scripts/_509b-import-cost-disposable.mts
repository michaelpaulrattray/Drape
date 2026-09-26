/** #509 part 2: what does importing the PostHog SDK actually cost at boot? */
async function main(): Promise<void> {
  const t0 = performance.now();
  const mod = await import("posthog-node");
  const imported = performance.now() - t0;
  const t1 = performance.now();
  const client = new mod.PostHog("phc_measure_only_never_sent", {
    host: "https://us.i.posthog.com",
    disableGeoip: true,
    disableRemoteFeatureFlags: true,
    disableRemoteConfig: true,
    disableSurveys: true,
    preloadFeatureFlags: false,
    sendFeatureFlagEvent: false,
    personProfiles: "identified_only",
    flushAt: 20,
    flushInterval: 5000,
  });
  const constructed = performance.now() - t1;
  console.log(`import: ${imported.toFixed(1)} ms · construct: ${constructed.toFixed(1)} ms`);
  await client.shutdown(200).catch(() => undefined);
}
await main();
process.exit(0);
