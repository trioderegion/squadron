
import { MODULE } from '../module.js'
import { Logistics } from './logistics.js'
import { logger } from './logger.js'

const NAME = 'Lookout';

export class Lookout {

  static register() {
    Lookout.defaults();
    Lookout.hooks();
    Lookout.settings();
  }

  static hooks() {
    /* delay until all modules loaded (i.e. warpgate) */
    Hooks.once('ready', () => {
      Hooks.on('preUpdateToken', Lookout._preUpdateToken);
      Hooks.on('updateToken', Lookout._updateToken);
      warpgate.event.watch(MODULE[NAME].leaderMoveEvent, Logistics.handleLeaderMove, Logistics.containsOwnedFollower);
      warpgate.event.watch(MODULE[NAME].addFollowerEvent, Logistics.handleAddFollower, Logistics.tokenFirstOwner);
      warpgate.event.watch(MODULE[NAME].addLeaderEvent, Logistics.handleAddLeader, Logistics.tokenFirstOwner);
    });
  }

  static defaults() {
    MODULE[NAME] = {
      leaderMoveEvent: 'sq-leader-move',
      followerPauseEvent: 'sq-follow-pause',
      addFollowerEvent: 'sq-add-follower',
      addLeaderEvent: 'sq-add-leader',
      followersFlag: 'followers',
      followingFlag: 'following'
    }
  }

  static settings() {

  }

  static _preUpdateToken(tokenDoc, update, options, user) {
    if (update.x || update.y) {
      /* store 'old' location */
      mergeObject(options, {oldLoc: {x: tokenDoc.data.x, y: tokenDoc.data.y}});
    }
  }

  static _updateToken(tokenDoc, update, options, user) {

    /* only handle our initiated moves */
    if (user != game.user.id) return;
    
    if (update.x || update.y) {

      /* am I a leader? */
      const followers = tokenDoc.getFlag(MODULE.data.name, MODULE[NAME].followersFlag) ?? []
      if (followers.length == 0) return;

      //const oldLoc = {
      //  x: tokenDoc.data.x,
      //  y: tokenDoc.data.y
      //}

      const oldLoc = options.oldLoc;

      const newLoc = {
        x: update.x ?? tokenDoc.data.x,
        y: update.y ?? tokenDoc.data.y
      }
      
      const followVector = Logistics.createFollowVector(newLoc, oldLoc)

      const data = {
        leader: {
          tokenId: tokenDoc.id,
          sceneId: tokenDoc.parent.id,
          finalPosition: newLoc,
          followVector
        },
        followers,
      }
      // @TODO maybe queue or await
      
      warpgate.plugin.queueUpdate( async () => {
       await warpgate.event.notify(MODULE[NAME].leaderMoveEvent, data);
      });
    }
  }

  static async addFollower(leaderId, followerId, sceneId){


    /* ask for orientation */
    const dialogData = {
      buttons: [{
        label: 'up',
        value: {x:0, y:-1}
      },{
        label: 'down',
        value: {x:0, y:1}
      },{
        label: 'left',
        value: {x:1, y:0}
      },{
        label: 'right',
        value: {x:-1, y:0}
      }],
      title: 'Select marching direction'
    }

    const orientationVector = await warpgate.buttonDialog(dialogData);
    if (orientationVector === true) return;
    logger.debug('Behind vector', orientationVector);

    const eventData = {
      leaderId,
      followerId,
      sceneId,
      orientationVector //leader does not care about this
    }

    /* trigger all relevant events */
    await warpgate.event.notify(MODULE[NAME].addLeaderEvent, eventData);
    await warpgate.event.notify(MODULE[NAME].addFollowerEvent, eventData);
  }

  // @TODO handle establishing leader/follower pair
}
