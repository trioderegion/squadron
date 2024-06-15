import { MODULE } from "./module.mjs";
import { Logistics } from "./logistics.mjs";

export class Lookout {
  static register() {
    Lookout.hooks();
  }

  static hooks() {
    Hooks.on("preUpdateToken", Lookout._preUpdateToken);
    Hooks.on("updateToken", Lookout._updateToken);
    Hooks.on("deleteToken", Lookout._deleteToken);
    Hooks.on("pasteToken", Lookout._pasteToken);
    Hooks.on("preCreateToken", Lookout._preCreateToken);

    MODULE.comms.on( 
      MODULE.EVENT.leaderMove,
      Logistics.handleLeaderMove,
    );

    MODULE.comms.on(
      MODULE.EVENT.addFollower,
      Logistics.handleAddFollower
    );

    MODULE.comms.on(
      MODULE.EVENT.addLeader,
      Logistics.handleAddLeader
    );

    MODULE.comms.on(
      MODULE.EVENT.removeFollower,
      Logistics.handleRemoveFollower
    );

    MODULE.comms.on(
      MODULE.EVENT.removeLeader,
      Logistics.handleRemoveLeader,
    );

    MODULE.comms.on(
      MODULE.EVENT.notifyCollision,
      (eventData) => {
        if (eventData.user === game.user.id && !MODULE.setting('silentCollide')) {

          ui.notifications.warn(MODULE.format('feedback.wallCollision', {tokenId: eventData.tokenId, tokenName: eventData.tokenName}));
        }
      }
    );
  }

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
      tokenDoc.getFlag('%config.id%', MODULE.FLAG.followers) ?? [];
    if (followers.length > 0) {
      //console.debug(
      //  "Notifying followers of leader remove. Leader:",
      //  tokenDoc,
      //  "Followers:",
      //  followers
      //);

      /* notify each follower that their leader is being removed */
      followers.forEach( followerId => MODULE.comms.emit(MODULE.EVENT.removeLeader, {
        leaderId: tokenDoc.id,
        followerId,
        sceneId: tokenDoc.parent.id,
      }));
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
      foundry.utils.mergeObject(options, { oldLoc });
    }
  }

  static _updateToken(tokenDoc, update, options, user) {
    /* only handle our initiated moves */
    if (user != game.user.id) return;

    if (Lookout._shouldTrack(update)) {
      /* am I a leader? */
      const followers =
        tokenDoc.getFlag('%config.id%', MODULE.FLAG.followers) ?? [];

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

        MODULE.comms.emit(MODULE.EVENT.leaderMove, data);
      }
      // FOLLOWERS
      if (options.squadronEvent == MODULE.EVENT.leaderMove) {
        /* do not respond to our own move events */
        return;
      }

      /* am I a follower? */
      const leaders = tokenDoc.getFlag('%config.id%', MODULE.FLAG.leaders) ?? {};
      if (Object.keys(leaders).length > 0) {
        /* I am following someone and have moved independently of them -> Pause */
        Lookout.pause(tokenDoc);
      }
    }
  }

  static async pause(tokenDoc) {
    await tokenDoc.setFlag('%config.id%', MODULE.FLAG.paused, true);
  }

  static async addFollower(
    leaderId,
    followerId,
    sceneId,
    orientation = MODULE.CONST.QUERY,
    options = {}
  ) {
    const formation = new MODULE.api.Formation({
      leader: leaderId,
      follower: followerId,
      scene: sceneId,
    });

    if (orientation === MODULE.CONST.QUERY) {
      /* ask for orientation */
      return formation.render(true);
    }

    return formation.startFollow({orientationVector: orientation, ...options});
  }
}
