import { MODULE } from "./module.mjs";
import { Logistics, FollowVector } from "./logistics.mjs";

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
    const followers = tokenDoc.getFlag('%config.id%', MODULE.FLAG.followers) ?? [];
    if (followers.length > 0) {
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

  static _getLocation(tokenDoc, changes = {}) {
    const {width, height} = MODULE.getSize(tokenDoc);
    return {
      x: (changes.x ?? tokenDoc.x) + width/2,
      y: (changes.y ?? tokenDoc.y) + height/2,
      z: changes.elevation ?? tokenDoc.elevation,
    };
  }

  static _preUpdateToken(tokenDoc, update, options /*, user*/) {
    if (Lookout._shouldTrack(update)) {
      /* store 'old' location */
      const loc = Lookout._getLocation(tokenDoc);
      foundry.utils.mergeObject(options, { oldLoc: {[tokenDoc.id]: loc} });
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

        const newLoc = Lookout._getLocation(tokenDoc, update);
        const followVector = new FollowVector(newLoc, options.oldLoc[tokenDoc.id]);

        const data = {
          leader: {
            tokenId: tokenDoc.id,
            sceneId: tokenDoc.parent.id,
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
    followerIds,
    sceneId,
    orientation = MODULE.CONST.QUERY,
    options = {}
  ) {
    const formation = new MODULE.api.Formation({
      leader: leaderId,
      followers: followerIds,
      scene: sceneId,
    });

    if (orientation === MODULE.CONST.QUERY) {
      /* ask for orientation */
      return formation.render(true);
    }

    return formation.startFollow({orientationVector: orientation, ...options});
  }
}
