export const getQueueRedisConfig = () => ({
  host: process.env.IO_REDIS_SERVER,
  port: +(process.env.IO_REDIS_PORT || "6379"),
  password: process.env.IO_REDIS_PASSWORD || undefined,
  db: 3
});
