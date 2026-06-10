export const env = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev_secret',
  sessionSecret: process.env.SESSION_SECRET || 'dev_session_secret',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:8080',

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  instagram: {
    clientId: process.env.INSTAGRAM_CLIENT_ID || '',
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || '',
  },
  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
  },
  facebook: {
    clientId: process.env.FACEBOOK_CLIENT_ID || '',
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
  },
  tiktok: {
    clientId: process.env.TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_ID || '',
    clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
  },
  toss: {
    secretKey: process.env.TOSS_SECRET_KEY || '',
  },
};
