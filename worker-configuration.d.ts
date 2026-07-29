interface CloudflareEnvironment {
  DB: D1Database;
  BOOTSTRAP_TOKEN?: string;
}

interface ProvidedEnv extends CloudflareEnvironment {
  TEST_MIGRATIONS: D1Migration[];
}
