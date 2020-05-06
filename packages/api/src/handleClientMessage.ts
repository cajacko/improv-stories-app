import getDatabase from "./getDatabase";
import { broadCastStoriesChanged, broadCastSessionChanged } from "./broadcast";
import {
  ClientMessage,
  DatabaseSession,
  DatabaseStoryProps,
} from "./sharedTypes";
import logger from "./logger";
import {
  removeActiveUserFromStory,
  addActiveUserToStory,
  setSessionText,
  addUserToStory,
  removeStoryUser,
  setUser,
  getStoreStory,
  finishActiveStorySession,
  startNewStorySession,
  getGetDate,
  getGetId,
} from "./store";
import getRand from "./getRand";

// Want 1 more as we always round down the number in ui
const defaultSeconds = 40 + 1;

function switchOverMessage(
  userId: string,
  action: ClientMessage
  // NOTE: We want to return something other than undefined so TypeScript will ensure we cover every
  // condition
): string[] {
  switch (action.type) {
    case "ADD_ACTIVE_USER_TO_STORY":
      return broadCastStoriesChanged(
        addActiveUserToStory(userId, action.payload.storyId)
      );
    case "SET_SESSION_TEXT":
      const session = setSessionText(
        userId,
        action.payload.storyId,
        action.payload.text
      );

      if (!session) return [];

      broadCastSessionChanged(action.payload.storyId, session);

      return [];
    case "ADD_USER_TO_STORY":
      return broadCastStoriesChanged(
        addUserToStory(userId, action.payload.storyId, action.payload.isActive)
      );
    case "REMOVE_ACTIVE_USER_FROM_STORY":
      return broadCastStoriesChanged(
        removeActiveUserFromStory(userId, action.payload.storyId)
      );
    case "REMOVE_USER_FROM_STORY":
      return broadCastStoriesChanged(
        removeStoryUser(userId, action.payload.storyId)
      );
    case "SET_USER_DETAILS":
      return broadCastStoriesChanged(
        setUser(userId, action.payload.userDetails)
      );
    // NOTE: Do not add a default, then TypeScript will ensure we're handling every action
  }
}

const storyTimeouts: { [K: string]: number | undefined } = {};

function getSeconds(storyId: string, callback: (seconds: number) => void) {
  const onError = (error: Error) => {
    logger.log("Error getting seconds from database", { error });
    callback(defaultSeconds);
  };

  try {
    // TODO: Share all refs with frontend
    getDatabase()
      .ref(`/storiesById/${storyId}/storyProps`)
      .once(
        "value",
        (snapshot) => {
          // TODO: Cast as unknown and do the same stuff we do in frontend to validate.
          var data = snapshot.val() as undefined | DatabaseStoryProps;

          if (!data) {
            callback(defaultSeconds);
            return;
          }

          callback(data.secondsPerRound || defaultSeconds);
        },
        onError
      );
  } catch (error) {
    onError(error);
  }
}

function storyLoop(storyId: string) {
  const clear = () => {
    if (storyTimeouts[storyId]) clearTimeout(storyTimeouts[storyId]);
  };

  const story = getStoreStory(storyId);

  if (!story) {
    clear();
    return;
  }

  const activeUsers = Object.keys(story.activeUsers);
  const isActive = activeUsers.length >= 2 || !!story.activeSession;

  if (isActive && !story.activeSession) {
    getSeconds(storyId, (seconds) => {
      const id = getGetId()();
      const startDate = getGetDate()();
      const endDate = new Date(startDate);
      endDate.setSeconds(endDate.getSeconds() + seconds);

      const lastUserId = story.lastSession && story.lastSession.user;

      const nextUserIds = activeUsers.filter((userId) => userId !== lastUserId);

      const nextUserId =
        nextUserIds[Math.floor(getRand() * nextUserIds.length)];

      startNewStorySession(
        {
          id,
          dateModified: startDate,
          dateStarted: startDate,
          dateWillFinish: endDate.toISOString(),
          entries: [],
          finalEntry: "",
          version: 0,
          user: nextUserId,
        },
        storyId
      );

      broadCastStoriesChanged([storyId]);

      logger.log("Story timeout start", { storyId });

      storyTimeouts[storyId] = setTimeout(() => {
        logger.log("Story timeout end", { storyId });

        const story = getStoreStory(storyId);

        if (
          story &&
          story.activeSession &&
          story.activeSession.entries.length
        ) {
          const ref = getDatabase().ref(`/storiesById/${storyId}/entries`);

          const session: DatabaseSession = {
            id: story.activeSession.id,
            dateWillFinish: story.activeSession.dateWillFinish,
            dateStarted: story.activeSession.dateStarted,
            dateModified: story.activeSession.dateModified,
            finalEntry: story.activeSession.finalEntry,
            entries: story.activeSession.entries,
            userId: story.activeSession.user,
            version: story.activeSession.version,
          };

          logger.log("Setting session in database", session);

          ref
            .push(session)
            .then(() => {
              logger.log("Set session in database", session);
            })
            .catch((error) => {
              logger.log("Error setting session in database", {
                session,
                error,
              });
            });
        }

        finishActiveStorySession(storyId);
        storyLoop(storyId);
        broadCastStoriesChanged([storyId]);
      }, seconds * 1000);
    });
  } else if (activeUsers.length <= 0) {
    clear();

    if (story.activeSession) {
      finishActiveStorySession(storyId);
      broadCastStoriesChanged([storyId]);
    }
  }
}

function handleClientMessage(userId: string, action: ClientMessage) {
  const changedStoryIds = switchOverMessage(userId, action);

  changedStoryIds.forEach(storyLoop);
}

export default handleClientMessage;
