'use client';

import { useState, useEffect } from 'react';

export default function CalendarIntegrations({ boardId }) {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    checkConnections();

    // Check for OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const googleConnected = urlParams.get('google_connected');
    const outlookConnected = urlParams.get('outlook_connected');

    if (googleConnected === 'true') {
      handleOAuthCallback('google', urlParams);
    } else if (outlookConnected === 'true') {
      handleOAuthCallback('outlook', urlParams);
    }
  }, []);

  const checkConnections = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/integrations/calendar/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setGoogleConnected(data.google || false);
        setOutlookConnected(data.outlook || false);
        setLastSync(data.lastSync);
      }
    } catch (error) {
      console.error('Failed to check integration status:', error);
    }
  };

  const handleOAuthCallback = async (provider, params) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/integrations/calendar/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider,
          accessToken: params.get('access_token'),
          refreshToken: params.get('refresh_token'),
          expiresIn: parseInt(params.get('expires_in'))
        })
      });

      if (response.ok) {
        if (provider === 'google') setGoogleConnected(true);
        if (provider === 'outlook') setOutlookConnected(true);

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);

        if (window.addNotification) {
          window.addNotification(`${provider} calendar connected successfully!`, 'success');
        }
      } else {
        throw new Error('Failed to connect');
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      if (window.addNotification) {
        window.addNotification(`Failed to connect ${provider} calendar`, 'error');
      }
    }
  };

  const connectGoogle = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/api/integrations/google/callback`;
    const scope = 'https://www.googleapis.com/auth/calendar.events';

    const authUrl = `https://accounts.google.com/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`;

    window.location.href = authUrl;
  };

  const connectOutlook = () => {
    const clientId = process.env.NEXT_PUBLIC_OUTLOOK_CLIENT_ID;
    const redirectUri = `${window.location.origin}/api/integrations/outlook/callback`;
    const scope = 'Calendars.ReadWrite offline_access';

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `access_type=offline`;

    window.location.href = authUrl;
  };

  const syncToExternal = async (provider) => {
    setSyncing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/integrations/calendar/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ provider, boardId })
      });

      if (response.ok) {
        const data = await response.json();
        setLastSync(new Date());
        if (window.addNotification) {
          window.addNotification(`Successfully synced to ${provider}!`, 'success');
        }
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      console.error('Sync failed:', error);
      if (window.addNotification) {
        window.addNotification(`Failed to sync to ${provider}`, 'error');
      }
    } finally {
      setSyncing(false);
    }
  };

  const disconnect = async (provider) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/integrations/calendar/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ provider })
      });

      if (response.ok) {
        if (provider === 'google') setGoogleConnected(false);
        if (provider === 'outlook') setOutlookConnected(false);
        if (window.addNotification) {
          window.addNotification(`Disconnected from ${provider}`, 'success');
        }
      }
    } catch (error) {
      console.error('Disconnect failed:', error);
      if (window.addNotification) {
        window.addNotification(`Failed to disconnect from ${provider}`, 'error');
      }
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Calendar Integrations
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Google Calendar */}
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div>
                <h4 className="text-white font-medium">Google Calendar</h4>
                <p className="text-gray-400 text-sm">Sync tasks with Google Calendar</p>
              </div>
            </div>
            <div className={`w-3 h-3 rounded-full ${googleConnected ? 'bg-green-400' : 'bg-gray-500'}`}></div>
          </div>

          <div className="space-y-3">
            {!googleConnected ? (
              <button
                onClick={connectGoogle}
                className="w-full px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Connect Google Calendar
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => syncToExternal('google')}
                  disabled={syncing}
                  className="w-full px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {syncing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin"></div>
                      Syncing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Sync to Google Calendar
                    </>
                  )}
                </button>
                <button
                  onClick={() => disconnect('google')}
                  className="w-full px-4 py-2 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/30 text-gray-400 rounded-lg font-medium transition-all"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Outlook Calendar */}
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.53 4.306v15.363q0 .807-.472 1.433-.472.627-1.253.85-.58.154-1.14.154H5.333q-.806 0-1.432-.472-.627-.472-.85-1.254-.154-.58-.154-1.14V4.306q0-.807.472-1.433.472-.627 1.253-.85.58-.154 1.14-.154h13.333q.806 0 1.432.472.627.472.85 1.254.154.58.154 1.14z"/>
                  <path d="M21.333 4.306H5.333V7h16V4.306zM5.333 8.667h16v2.666h-16V8.667zm0 4h16v2.666h-16V12.667zm0 4h16v2.666h-16V16.667z"/>
                </svg>
              </div>
              <div>
                <h4 className="text-white font-medium">Outlook Calendar</h4>
                <p className="text-gray-400 text-sm">Sync tasks with Outlook Calendar</p>
              </div>
            </div>
            <div className={`w-3 h-3 rounded-full ${outlookConnected ? 'bg-green-400' : 'bg-gray-500'}`}></div>
          </div>

          <div className="space-y-3">
            {!outlookConnected ? (
              <button
                onClick={connectOutlook}
                className="w-full px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Connect Outlook Calendar
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => syncToExternal('outlook')}
                  disabled={syncing}
                  className="w-full px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {syncing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin"></div>
                      Syncing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Sync to Outlook Calendar
                    </>
                  )}
                </button>
                <button
                  onClick={() => disconnect('outlook')}
                  className="w-full px-4 py-2 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/30 text-gray-400 rounded-lg font-medium transition-all"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {lastSync && (
        <div className="text-center text-sm text-gray-500">
          Last synced: {lastSync.toLocaleString()}
        </div>
      )}
    </div>
  );
}