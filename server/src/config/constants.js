module.exports = {
  MODERATOR_TOKEN_THRESHOLD: Number(
    process.env.MODERATOR_TOKEN_THRESHOLD || 1000,
  ),
  JWT_SECRET: process.env.JWT_SECRET || "development-secret",
  JWT_EXPIRES_IN: "7d",
};
