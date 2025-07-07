// /config/production.js
module.exports = {
    env: "staging",
    port: process.env.PORT || 80,
    // db: {
    //   host: process.env.DB_HOST || "prod-db-host",
    //   port: process.env.DB_PORT || 5432,
    //   user: process.env.DB_USER || "produser",
    //   password: process.env.DB_PASS || "prodpass",
    //   database: process.env.DB_NAME || "proddb",
    // },
    secretKey: process.env.SECRET_KEY || "prodSecretKey",
  };