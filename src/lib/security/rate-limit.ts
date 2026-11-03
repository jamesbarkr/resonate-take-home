type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter(
    (timestamp) => now - timestamp < windowMs,
  );

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now;
    buckets.set(key, bucket);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((windowMs - (now - oldest)) / 1000),
      ),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);

  if (buckets.size > 5_000) {
    for (const [bucketKey, value] of buckets) {
      if (value.timestamps.length === 0) buckets.delete(bucketKey);
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
