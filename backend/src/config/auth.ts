export type AuthConfig = {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtIssuer: string;
};

export const getAuthConfig = (): AuthConfig => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }

  return {
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    jwtIssuer: process.env.JWT_ISSUER ?? 'cloudcart-api',
  };
};
