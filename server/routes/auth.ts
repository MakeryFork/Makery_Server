import { Router } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { auth } from '../middleware/auth';
import { env } from '../config/env';
import { Provider } from '@prisma/client';

const router = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

function callbackUrl(req: { protocol: string; get: (h: string) => string | undefined }, provider: string) {
  return `${req.protocol}://${req.get('host')}/api/v1/auth/${provider}/callback`;
}

async function upsertUser(provider: Provider, providerId: string, name: string, profileImageUrl?: string) {
  const social = await prisma.socialAccount.findUnique({
    where: { provider_providerId: { provider, providerId } },
    include: { user: true },
  });

  if (social) {
    await prisma.user.update({
      where: { id: social.userId },
      data: { name, ...(profileImageUrl && { profileImageUrl }) },
    });
    return social.user;
  }

  return prisma.user.create({
    data: {
      name,
      profileImageUrl,
      socialAccounts: { create: { provider, providerId } },
    },
  });
}

function issueToken(userId: number, name: string) {
  return jwt.sign({ id: userId, name }, env.jwtSecret, { expiresIn: '7d' });
}

// ─── Google ───────────────────────────────────────────────────────────────────

router.get('/google', (req, res) => {
  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: callbackUrl(req, 'google'),
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  const { code } = req.query as { code: string };
  try {
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      redirect_uri: callbackUrl(req, 'google'),
      grant_type: 'authorization_code',
    });
    const infoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });
    const { sub, name, picture } = infoRes.data;
    const user = await upsertUser(Provider.GOOGLE, sub, name, picture);
    const token = issueToken(user.id, user.name);
    res.redirect(`${env.clientUrl}/auth/callback?token=${token}&userId=${user.id}`);
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect(`${env.clientUrl}/auth/callback?error=google_failed`);
  }
});

// ─── Instagram ────────────────────────────────────────────────────────────────

router.get('/instagram', (req, res) => {
  const params = new URLSearchParams({
    client_id: env.instagram.clientId,
    redirect_uri: callbackUrl(req, 'instagram'),
    scope: 'user_profile,user_media',
    response_type: 'code',
  });
  res.redirect(`https://api.instagram.com/oauth/authorize?${params}`);
});

router.get('/instagram/callback', async (req, res) => {
  const { code } = req.query as { code: string };
  try {
    const form = new URLSearchParams({
      client_id: env.instagram.clientId,
      client_secret: env.instagram.clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl(req, 'instagram'),
      code,
    });
    const tokenRes = await axios.post('https://api.instagram.com/oauth/access_token', form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const { access_token, user_id } = tokenRes.data;
    const profileRes = await axios.get(
      `https://graph.instagram.com/${user_id}?fields=id,username&access_token=${access_token}`,
    );
    const { id, username } = profileRes.data;
    const user = await upsertUser(Provider.INSTAGRAM, id, username);
    const token = issueToken(user.id, user.name);
    res.redirect(`${env.clientUrl}/auth/callback?token=${token}&userId=${user.id}`);
  } catch (err) {
    console.error('Instagram OAuth error:', err);
    res.redirect(`${env.clientUrl}/auth/callback?error=instagram_failed`);
  }
});

// ─── YouTube ──────────────────────────────────────────────────────────────────

router.get('/youtube', (req, res) => {
  const params = new URLSearchParams({
    client_id: env.youtube.clientId,
    redirect_uri: callbackUrl(req, 'youtube'),
    response_type: 'code',
    scope: 'openid profile https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/youtube/callback', async (req, res) => {
  const { code } = req.query as { code: string };
  try {
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: env.youtube.clientId,
      client_secret: env.youtube.clientSecret,
      redirect_uri: callbackUrl(req, 'youtube'),
      grant_type: 'authorization_code',
    });
    const infoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });
    const { sub, name, picture } = infoRes.data;
    const user = await upsertUser(Provider.YOUTUBE, sub, name, picture);
    const token = issueToken(user.id, user.name);
    res.redirect(`${env.clientUrl}/auth/callback?token=${token}&userId=${user.id}`);
  } catch (err) {
    console.error('YouTube OAuth error:', err);
    res.redirect(`${env.clientUrl}/auth/callback?error=youtube_failed`);
  }
});

// ─── Facebook ─────────────────────────────────────────────────────────────────

router.get('/facebook', (req, res) => {
  const params = new URLSearchParams({
    client_id: env.facebook.clientId,
    redirect_uri: callbackUrl(req, 'facebook'),
    scope: 'public_profile',
    response_type: 'code',
  });
  res.redirect(`https://www.facebook.com/v18.0/dialog/oauth?${params}`);
});

router.get('/facebook/callback', async (req, res) => {
  const { code } = req.query as { code: string };
  try {
    const tokenRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: env.facebook.clientId,
        client_secret: env.facebook.clientSecret,
        redirect_uri: callbackUrl(req, 'facebook'),
        code,
      },
    });
    const profileRes = await axios.get('https://graph.facebook.com/me', {
      params: { fields: 'id,name,picture', access_token: tokenRes.data.access_token },
    });
    const { id, name, picture } = profileRes.data;
    const user = await upsertUser(Provider.FACEBOOK, id, name, picture?.data?.url);
    const token = issueToken(user.id, user.name);
    res.redirect(`${env.clientUrl}/auth/callback?token=${token}&userId=${user.id}`);
  } catch (err) {
    console.error('Facebook OAuth error:', err);
    res.redirect(`${env.clientUrl}/auth/callback?error=facebook_failed`);
  }
});

// ─── TikTok ───────────────────────────────────────────────────────────────────

router.get('/tiktok', (req, res) => {
  const params = new URLSearchParams({
    client_key: env.tiktok.clientId,
    redirect_uri: callbackUrl(req, 'tiktok'),
    scope: 'user.info.basic',
    response_type: 'code',
  });
  res.redirect(`https://www.tiktok.com/v2/auth/authorize?${params}`);
});

router.get('/tiktok/callback', async (req, res) => {
  const { code } = req.query as { code: string };
  try {
    const tokenRes = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: env.tiktok.clientId,
        client_secret: env.tiktok.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl(req, 'tiktok'),
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const { access_token, open_id } = tokenRes.data;
    const profileRes = await axios.post(
      'https://open.tiktokapis.com/v2/user/info/',
      { fields: ['display_name', 'avatar_url'] },
      { headers: { Authorization: `Bearer ${access_token}` } },
    );
    const { display_name, avatar_url } = profileRes.data.data.user;
    const user = await upsertUser(Provider.TIKTOK, open_id, display_name, avatar_url);
    const token = issueToken(user.id, user.name);
    res.redirect(`${env.clientUrl}/auth/callback?token=${token}&userId=${user.id}`);
  } catch (err) {
    console.error('TikTok OAuth error:', err);
    res.redirect(`${env.clientUrl}/auth/callback?error=tiktok_failed`);
  }
});

// ─── /me ──────────────────────────────────────────────────────────────────────

router.get('/me', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        socialAccounts: { select: { provider: true } },
        _count: { select: { posts: true, followers: true, following: true } },
      },
    });
    if (!user) return res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' });

    return res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        bio: user.bio,
        profileImageUrl: user.profileImageUrl,
        socialAccounts: user.socialAccounts.map((s) => s.provider),
        _count: user._count,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
});

export default router;
