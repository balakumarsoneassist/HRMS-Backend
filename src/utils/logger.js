const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure the logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Get the current date in YYYY-MM-DD format
const getLogFileName = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `log-${year}-${month}-${day}.log`;
};

// Create the logger
const logger = createLogger({
    level: 'info', // Minimum log level
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
    ),
    transports: [
        new transports.File({
            filename: path.join(logsDir, getLogFileName()),
            level: 'info', // Logs info and above levels
        }),
    ],
});

    logger.add(
        new transports.Console({
            format: format.combine(format.colorize(), format.simple()),
        })
    );

module.exports = logger;
