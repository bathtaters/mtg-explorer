module.exports = {
    debug: process.env.NODE_ENV === 'production' ? () => {} : console.debug,
    log: console.log,
    warn: console.warn,
    error: console.error,
}