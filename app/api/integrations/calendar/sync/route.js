import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import User from '@/models/User';
import Task from '@/models/Task';
import Board from '@/models/Board';

export async function POST(request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { provider, boardId } = await request.json();

    if (!provider || !boardId) {
      return NextResponse.json({ error: 'Provider and boardId are required' }, { status: 400 });
    }

    // Check if user has access to the board
    const board = await Board.findById(boardId);
    if (!board || !board.members.includes(user._id)) {
      return NextResponse.json({ error: 'Board not found or access denied' }, { status: 403 });
    }

    // Check if integration is connected
    const integrations = user.integrations || {};
    if (!integrations[provider]?.connected) {
      return NextResponse.json({ error: `${provider} integration not connected` }, { status: 400 });
    }

    // Get tasks for the board
    const tasks = await Task.find({
      board: boardId,
      dueDate: { $ne: null }
    }).populate('assignedTo', 'name email');

    let syncResult = { success: true, synced: 0, errors: [] };

    if (provider === 'google') {
      syncResult = await syncToGoogleCalendar(user, tasks, integrations.google);
    } else if (provider === 'outlook') {
      syncResult = await syncToOutlookCalendar(user, tasks, integrations.outlook);
    } else {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    // Update last sync time
    await User.findByIdAndUpdate(user._id, {
      $set: {
        'integrations.lastSync': new Date()
      }
    });

    return NextResponse.json(syncResult);
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function syncToGoogleCalendar(user, tasks, googleIntegration) {
  const synced = [];
  const errors = [];

  try {
    // Get access token (refresh if needed)
    const accessToken = await getGoogleAccessToken(googleIntegration);

    for (const task of tasks) {
      try {
        const eventData = {
          summary: task.title,
          description: task.description || '',
          start: {
            dateTime: new Date(task.dueDate).toISOString(),
            timeZone: 'UTC'
          },
          end: {
            dateTime: new Date(new Date(task.dueDate).getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
            timeZone: 'UTC'
          },
          attendees: task.assignedTo ? [{
            email: task.assignedTo.email,
            displayName: task.assignedTo.name
          }] : []
        };

        // Check if event already exists
        const existingEventId = task.integrations?.google?.eventId;
        let response;

        if (existingEventId) {
          // Update existing event
          response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingEventId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
          });
        } else {
          // Create new event
          response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
          });
        }

        if (response.ok) {
          const event = await response.json();

          // Update task with event ID
          await Task.findByIdAndUpdate(task._id, {
            $set: {
              'integrations.google.eventId': event.id
            }
          });

          synced.push(task.title);
        } else {
          const error = await response.json();
          errors.push(`Failed to sync "${task.title}": ${error.error?.message || 'Unknown error'}`);
        }
      } catch (taskError) {
        errors.push(`Failed to sync "${task.title}": ${taskError.message}`);
      }
    }
  } catch (error) {
    errors.push(`Google Calendar sync failed: ${error.message}`);
  }

  return { success: errors.length === 0, synced: synced.length, errors };
}

async function syncToOutlookCalendar(user, tasks, outlookIntegration) {
  const synced = [];
  const errors = [];

  try {
    // Get access token (refresh if needed)
    const accessToken = await getOutlookAccessToken(outlookIntegration);

    for (const task of tasks) {
      try {
        const eventData = {
          subject: task.title,
          body: {
            contentType: 'Text',
            content: task.description || ''
          },
          start: {
            dateTime: new Date(task.dueDate).toISOString(),
            timeZone: 'UTC'
          },
          end: {
            dateTime: new Date(new Date(task.dueDate).getTime() + 60 * 60 * 1000).toISOString(),
            timeZone: 'UTC'
          },
          attendees: task.assignedTo ? [{
            emailAddress: {
              address: task.assignedTo.email,
              name: task.assignedTo.name
            },
            type: 'required'
          }] : []
        };

        // Check if event already exists
        const existingEventId = task.integrations?.outlook?.eventId;
        let response;

        if (existingEventId) {
          // Update existing event
          response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${existingEventId}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
          });
        } else {
          // Create new event
          response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
          });
        }

        if (response.ok) {
          const event = await response.json();

          // Update task with event ID
          await Task.findByIdAndUpdate(task._id, {
            $set: {
              'integrations.outlook.eventId': event.id
            }
          });

          synced.push(task.title);
        } else {
          const error = await response.json();
          errors.push(`Failed to sync "${task.title}": ${error.error?.message || 'Unknown error'}`);
        }
      } catch (taskError) {
        errors.push(`Failed to sync "${task.title}": ${taskError.message}`);
      }
    }
  } catch (error) {
    errors.push(`Outlook Calendar sync failed: ${error.message}`);
  }

  return { success: errors.length === 0, synced: synced.length, errors };
}

async function getGoogleAccessToken(googleIntegration) {
  // Check if token is still valid
  if (googleIntegration.expiresAt > Date.now()) {
    return googleIntegration.accessToken;
  }

  // Refresh token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: googleIntegration.refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Google access token');
  }

  const data = await response.json();

  // Update stored tokens
  await User.findOneAndUpdate(
    { 'integrations.google.refreshToken': googleIntegration.refreshToken },
    {
      $set: {
        'integrations.google.accessToken': data.access_token,
        'integrations.google.expiresAt': Date.now() + (data.expires_in * 1000)
      }
    }
  );

  return data.access_token;
}

async function getOutlookAccessToken(outlookIntegration) {
  // Check if token is still valid
  if (outlookIntegration.expiresAt > Date.now()) {
    return outlookIntegration.accessToken;
  }

  // Refresh token
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET,
      refresh_token: outlookIntegration.refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Outlook access token');
  }

  const data = await response.json();

  // Update stored tokens
  await User.findOneAndUpdate(
    { 'integrations.outlook.refreshToken': outlookIntegration.refreshToken },
    {
      $set: {
        'integrations.outlook.accessToken': data.access_token,
        'integrations.outlook.expiresAt': Date.now() + (data.expires_in * 1000)
      }
    }
  );

  return data.access_token;
}