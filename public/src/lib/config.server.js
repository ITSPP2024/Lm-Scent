// src/lib/config.server.ts
import process from "node:process";
function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV
    // Add server-only values here, e.g.:
    //   databaseUrl: process.env.DATABASE_URL,
    //   stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  };
}
export {
  getServerConfig
};
