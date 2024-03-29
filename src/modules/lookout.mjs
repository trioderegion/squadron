import { MODULE } from "./module.mjs";
import { Logistics } from "./logistics.mjs";
import { logger } from "./logger.mjs";
import { UserInterface } from "./user-interface.mjs";
import FormationApp from "../apps/Formation";

const NAME = "Lookout";

export class Lookout {
  static register() {
    Lookout.defaults();
    Lookout.hooks();
    Lookout.settings();
  }

  static hooks() {
    /* delay until all modules loaded (i.e. warpgate) */
    Hooks.once("ready", () => {
      Hooks.on("preUpdateToken", Lookout._preUpdateToken);
      Hooks.on("updateToken", Lookout._updateToken);
      Hooks.on("deleteToken", Lookout._deleteToken);
      Hooks.on("pasteToken", Lookout._pasteToken);
      Hooks.on("preCreateToken", Lookout._preCreateToken);

      warpgate.event.watch(
        MODULE[NAME].leaderMoveEvent,
        Logistics.handleLeaderMove,
        Logistics.containsOwnedFollower
      );

      warpgate.event.watch(
        MODULE[NAME].addFollowerEvent,
        Logistics.handleAddFollower,
        Logistics.leaderFirstOwner
      );

      warpgate.event.watch(
        MODULE[NAME].addLeaderEvent,
        Logistics.handleAddLeader,
        Logistics.followerFirstOwner
      );

      warpgate.event.watch(
        MODULE[NAME].removeFollowerEvent,
        Logistics.handleRemoveFollower,
        Logistics.leaderFirstOwner
      );

      warpgate.event.watch(
        MODULE[NAME].removeLeaderEvent,
        Logistics.handleRemoveLeader,
        Logistics.followerFirstOwner
      );

      warpgate.event.watch(
        MODULE[NAME].notifyCollision,
        UserInterface.notifyCollision,
        (data) => {
          return data.user == game.user.id;
        }
      );
    });
  }

  static defaults() {
    MODULE[NAME] = {
      leaderMoveEvent: "sq-leader-move",
      followerPauseEvent: "sq-follow-pause",
      addFollowerEvent: "sq-add-follower",
      addLeaderEvent: "sq-add-leader",
      removeFollowerEvent: "sq-remove-follower",
      removeLeaderEvent: "sq-remove-leader",
      notifyCollision: "sq-notify-collision",
      followersFlag: "followers",
      leadersFlag: "leaders",
      followPause: "paused",
      lastUser: "user",
    };
  }

  static settings() {}

  static _preCreateToken(token /*data, options*/) {
    token.updateSource({ "flags.-=squadron": null });
  }

  static _pasteToken(/*sourceArray*/ _, createArray) {
    /* strip any formation info from the new tokens */
    createArray.forEach((data) => delete data.flags?.squadron);
  }

  static _deleteToken(tokenDoc, /*options*/ _, user) {
    /* only handle our initiated moves */
    if (user != game.user.id) return;

    /* am I a leader? */
    const followers =
      tokenDoc.getFlag(MODULE.data.name, MODULE[NAME].followersFlag) ?? [];
    if (followers.length > 0) {
      logger.debug(
        "Notifying followers of leader remove. Leader:",
        tokenDoc,
        "Followers:",
        followers
      );
      /* notify each follower that their leader is being removed */
      followers.forEach((followerId) => {
        warpgate.plugin.queueUpdate(() => {
          return warpgate.event.notify(MODULE[NAME].removeLeaderEvent, {
            leaderId: tokenDoc.id,
            followerId,
            sceneId: tokenDoc.parent.id,
          });
        });
      });
    }

    /* am I a follower? */
    Logistics.announceStopFollow(tokenDoc);
  }

  static _shouldTrack(change) {
    return (
      typeof change.x === "number" ||
      typeof change.y === "number" ||
      typeof change.elevation === "number"
    );
  }

  static _getLocation(tokenDoc) {
    return {
      ...tokenDoc.object.center,
      z: tokenDoc.elevation,
    };
  }

  static _preUpdateToken(tokenDoc, update, options /*, user*/) {
    if (Lookout._shouldTrack(update)) {
      /* store 'old' location */
      const oldLoc = Lookout._getLocation(tokenDoc);

      mergeObject(options, { oldLoc });
    }
  }

  static _updateToken(tokenDoc, update, options, user) {
    /* only handle our initiated moves */
    if (user != game.user.id) return;

    if (Lookout._shouldTrack(update)) {
      /* am I a leader? */
      const followers =
        tokenDoc.getFlag(MODULE.data.name, MODULE[NAME].followersFlag) ?? [];

      if (followers.length > 0) {
        const oldLoc = options.oldLoc;

        const newLoc = Lookout._getLocation(tokenDoc);

        const followVector = Logistics.createFollowVector(newLoc, oldLoc);

        const data = {
          leader: {
            tokenId: tokenDoc.id,
            sceneId: tokenDoc.parent.id,
            finalPosition: newLoc,
            followVector,
          },
          followers,
        };

        warpgate.plugin.queueUpdate(async () => {
          await warpgate.event.notify(MODULE[NAME].leaderMoveEvent, data);
        });
      }
      // FOLLOWERS
      if (options.squadronEvent == MODULE[NAME].leaderMoveEvent) {
        /* do not respond to our own move events */
        return;
      }

      /* am I a follower? */
      const leaders =
        tokenDoc.getFlag(MODULE.data.name, MODULE[NAME].leadersFlag) ?? {};
      if (Object.keys(leaders).length > 0) {
        /* I am following someone and have moved independently of them -> Pause */
        warpgate.plugin.queueUpdate(async () => {
          await Lookout.pause(tokenDoc);
        });
      }
    }
  }

  static async pause(tokenDoc) {
    await tokenDoc.setFlag(MODULE.data.name, MODULE[NAME].followPause, true);
  }

  static async addFollower(
    leaderId,
    followerId,
    sceneId,
    orientation = squadron.CONST.QUERY,
    options = {}
  ) {
    const formation = new FormationApp({
      leader: leaderId,
      follower: followerId,
      scene: sceneId,
    });

    if (orientation === squadron.CONST.QUERY) {
      /* ask for orientation */
      return formation.render(true);
    }

    return formation.startFollow({orientationVector: orientation, ...options});
  }
}
