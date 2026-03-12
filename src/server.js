/**
 * Ajicore Server Entry Point
 * Initializes the Express application and starts listening for requests.
 */
const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');

const PORT = env.PORT;

app.listen(PORT, () => {
  logger.info(` Ajicore server running on port ${PORT} [${env.NODE_ENV}]`);
  logger.info(` Health check: http://localhost:${PORT}/api/health`);
});
