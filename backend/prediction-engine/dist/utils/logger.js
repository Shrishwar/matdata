import winston from 'winston';
// Define log format
const logFormat = winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.errors({ stack: true }), winston.format.splat(), winston.format.json());
// Create the logger instance
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: logFormat,
    defaultMeta: { service: 'matka-prediction-engine' },
    transports: [
        // Write all logs with level `error` and below to `error.log`
        new winston.transports.File({
            filename: 'error.log',
            level: 'error'
        }),
        // Write all logs to `combined.log`
        new winston.transports.File({
            filename: 'combined.log'
        })
    ]
});
// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.simple())
    }));
}
export { logger };
//# sourceMappingURL=logger.js.map