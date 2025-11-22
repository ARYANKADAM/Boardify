import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import User from '@/models/User';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?error=${error}`);
    }

    if (!code) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?error=no_code`);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.OUTLOOK_CLIENT_ID,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/outlook/callback`
      })
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();

    // Get user info from Microsoft Graph
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?error=user_info_failed`);
    }

    const outlookUser = await userResponse.json();

    // Find user by email (assuming user is logged in and we can get their ID from session/token)
    // For now, we'll redirect to settings and let the frontend handle the connection
    // In a real implementation, you'd want to store the tokens securely associated with the user

    const redirectUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL}/settings`);
    redirectUrl.searchParams.set('outlook_connected', 'true');
    redirectUrl.searchParams.set('access_token', tokenData.access_token);
    redirectUrl.searchParams.set('refresh_token', tokenData.refresh_token);
    redirectUrl.searchParams.set('expires_in', tokenData.expires_in);

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Outlook OAuth callback error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?error=server_error`);
  }
}