import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export const signToken = (payload) => {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
};

export const verifyToken = (token) => {
  return jwt.verify(token, config.jwtSecret);
};

export const sendTokenCookie = (res, token) => {
  const isProduction = config.env === 'production';
  const maxAge = config.cookieMaxAgeDays * 24 * 60 * 60 * 1000;

  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge
  });
};

export const clearTokenCookie = (res) => {
  const isProduction = config.env === 'production';
  res.cookie('token', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    expires: new Date(0)
  });
};
