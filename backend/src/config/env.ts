import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 3333),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5174',

  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
};