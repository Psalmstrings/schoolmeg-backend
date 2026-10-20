import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { config } from './config/env.js';

const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(config.port, () => {
      console.log(`[SchoolMag API] Running in ${config.env} mode on port ${config.port}`);
    });

    const shutdown = async (signal) => {
      console.log(`\n[SchoolMag API] Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('[Server Startup Failure]:', error.message);
    process.exit(1);
  }
};

startServer();
