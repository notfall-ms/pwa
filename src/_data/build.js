module.exports = {
  env: process.env.NODE_ENV,
  year: new Date().getFullYear(),
  isDev: process.env.NODE_ENV !== 'production',
  now: new Date()
};