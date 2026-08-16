import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb';
import Activity from '../../../../models/Activity';
import List from '../../../../models/List';
import User from '../../../../models/User';
import jwt from 'jsonwebtoken';
import Board from '../../../../models/Board';
import logger from '../../../../lib/logger';

const JWT_SECRET = process.env.JWT_SECRET;

function getUserFromToken(req) {
  const auth = req.headers.get('authorization');
  if (!auth) return null;

  const token = auth.replace('Bearer ', '');

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function GET(req, context) {
  await connectToDatabase();

  const user = getUserFromToken(req);

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Resolve params
  const params =
    context && context.params
      ? await context.params
      : {};

  const { boardId } = params || {};

  if (!boardId) {
    return NextResponse.json(
      { error: 'Missing boardId' },
      { status: 400 }
    );
  }

  // --------------------------------------------------
  // CHECK BOARD ACCESS
  // --------------------------------------------------

  try {
    const board = await Board.findById(boardId);

    if (!board) {
      return NextResponse.json(
        { error: 'Board not found' },
        { status: 404 }
      );
    }

    const globalRole = (user.role || '')
      .toString()
      .toLowerCase();

    const isOwner =
      String(board.owner) === String(user.id);

    const isMember =
      Array.isArray(board.members) &&
      board.members.some(m => {
        const uid =
          m && m.user
            ? String(m.user)
            : String(m);

        return uid === String(user.id);
      });

    if (
      !(
        globalRole === 'admin' ||
        globalRole === 'owner' ||
        isOwner ||
        isMember
      )
    ) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

  } catch (e) {
    logger.error(
      e,
      'permission check failed for activity.get'
    );

    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }

  // --------------------------------------------------
  // GET ACTIVITIES
  // --------------------------------------------------

  let activities = await Activity.find({ boardId })
    .sort({ timestamp: -1 })
    .limit(100)
    .populate('userId', 'name email avatar');

  // Convert mongoose documents to plain objects
  activities = activities.map(activity =>
    activity.toObject()
  );

  // --------------------------------------------------
  // REPLACE LIST IDS WITH LIST TITLES
  // --------------------------------------------------

  try {
    const idRegex = /([0-9a-fA-F]{24})/g;

    const ids = new Set();

    activities.forEach(activity => {
      if (
        activity &&
        activity.details &&
        typeof activity.details === 'string'
      ) {
        const matches =
          activity.details.match(idRegex);

        if (matches) {
          matches.forEach(id => ids.add(id));
        }
      }
    });

    if (ids.size > 0) {
      const idArray = Array.from(ids);

      const lists = await List.find({
        _id: { $in: idArray }
      }).select('title');

      const titleMap = {};

      lists.forEach(list => {
        titleMap[String(list._id)] = list.title;
      });

      activities = activities.map(activity => {
        if (
          activity &&
          activity.details &&
          typeof activity.details === 'string'
        ) {
          let details = activity.details;

          details = details.replace(
            idRegex,
            match => {
              if (titleMap[match]) {
                return `"${titleMap[match]}"`;
              }

              return match;
            }
          );

          return {
            ...activity,
            details
          };
        }

        return activity;
      });
    }

  } catch (e) {
    logger.error(
      e,
      'failed to resolve list titles for activities'
    );
  }

  // --------------------------------------------------
  // REPLACE EMAILS WITH FIRST NAMES
  // --------------------------------------------------

  try {
    const emailRegex =
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

    const emails = new Set();

    activities.forEach(activity => {
      if (
        activity &&
        typeof activity.details === 'string'
      ) {
        const matches =
          activity.details.match(emailRegex);

        if (matches) {
          matches.forEach(email => {
            emails.add(email.toLowerCase());
          });
        }
      }

      // Also include the activity creator's email
      if (activity?.userId?.email) {
        emails.add(
          activity.userId.email.toLowerCase()
        );
      }
    });

    if (emails.size > 0) {
      const emailArray = Array.from(emails);

      const users = await User.find({
        email: {
          $in: emailArray
        }
      }).select('name email avatar');

      const userNameMap = {};

      users.forEach(dbUser => {
        const fullName =
          dbUser.name?.trim() || '';

        const firstName =
          fullName.split(/\s+/)[0] ||
          dbUser.email?.split('@')[0] ||
          'User';

        userNameMap[
          dbUser.email.toLowerCase()
        ] = firstName;
      });

      activities = activities.map(activity => {
        let details = activity.details;

        if (
          typeof details === 'string'
        ) {
          details = details.replace(
            emailRegex,
            email => {
              return (
                userNameMap[
                  email.toLowerCase()
                ] || email
              );
            }
          );
        }

        // Also make sure the activity creator
        // has the first name available.
        if (
          activity.userId &&
          activity.userId.name
        ) {
          const fullName =
            activity.userId.name.trim();

          activity.userId.name =
            fullName.split(/\s+/)[0];
        }

        return {
          ...activity,
          details
        };
      });
    }

  } catch (e) {
    logger.error(
      e,
      'failed to replace activity emails with names'
    );
  }

  // --------------------------------------------------
  // RETURN ACTIVITIES
  // --------------------------------------------------

  return NextResponse.json(
    { activities },
    { status: 200 }
  );
}