
import { MODULE } from '../module.js'
import { Logistics } from './logistics.js'
import { logger } from './logger.js'
import { UserInterface } from './user-interface.js'

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
      Hooks.on('deleteToken', Lookout._deleteToken);

      warpgate.event.watch(MODULE[NAME].leaderMoveEvent, Logistics.handleLeaderMove, Logistics.containsOwnedFollower);

      warpgate.event.watch(MODULE[NAME].addFollowerEvent, Logistics.handleAddFollower, Logistics.leaderFirstOwner);

      warpgate.event.watch(MODULE[NAME].addLeaderEvent, Logistics.handleAddLeader, Logistics.followerFirstOwner);

      warpgate.event.watch(MODULE[NAME].removeFollowerEvent, Logistics.handleRemoveFollower, Logistics.leaderFirstOwner);

      warpgate.event.watch(MODULE[NAME].removeLeaderEvent, Logistics.handleRemoveLeader, Logistics.followerFirstOwner);

      warpgate.event.watch(MODULE[NAME].notifyCollision, UserInterface.notifyCollision, (data) => {return data.user == game.user.id})
    });
  }

  static defaults() {
    MODULE[NAME] = {
      leaderMoveEvent: 'sq-leader-move',
      followerPauseEvent: 'sq-follow-pause',
      addFollowerEvent: 'sq-add-follower',
      addLeaderEvent: 'sq-add-leader',
      removeFollowerEvent: 'sq-remove-follower',
      removeLeaderEvent: 'sq-remove-leader',
      notifyCollision: 'sq-notify-collision',
      followersFlag: 'followers',
      leadersFlag: 'leaders',
      followPause: 'paused',
      lastUser: 'user',
    }
  }

  static settings() {

  }

  static _deleteToken(tokenDoc, options, user){

    /* only handle our initiated moves */
    if (user != game.user.id) return;

    /* am I a leader? */
    const followers = tokenDoc.getFlag(MODULE.data.name, MODULE[NAME].followersFlag) ?? []
    if (followers.length > 0) {

      logger.debug('Notifying followers of leader remove. Leader:', tokenDoc, 'Followers:', followers);
      /* notify each follower that their leader is being removed */
      followers.forEach( (followerId) => {
        warpgate.plugin.queueUpdate( () => {
          return warpgate.event.notify(MODULE[NAME].removeLeaderEvent,
            {
              leaderId: tokenDoc.id,
              followerId,
              sceneId: tokenDoc.parent.id
            });
        });
      });
    }

    /* am I a follower? */
    Logistics.announceStopFollow(tokenDoc);
  }

  static _shouldTrack(change){
    return typeof change.x === 'number' ||
           typeof change.y === 'number' ||
           typeof change.elevation === 'number';
  }

  static _getLocation(tokenDoc){
      return {
        ...tokenDoc.object.center,
        z: tokenDoc.data.elevation
      }
  }

  static _preUpdateToken(tokenDoc, update, options, user) {
    if (Lookout._shouldTrack(update)) {
      /* store 'old' location */

      const oldLoc = Lookout._getLocation(tokenDoc); 

      mergeObject(options, {oldLoc});
    }
  }

  static _updateToken(tokenDoc, update, options, user) {

    /* only handle our initiated moves */
    if (user != game.user.id) return;
    
    if (Lookout._shouldTrack(update)) {

      /* am I a leader? */
      const followers = tokenDoc.getFlag(MODULE.data.name, MODULE[NAME].followersFlag) ?? []
      if (followers.length > 0) {

        const oldLoc = options.oldLoc;

        const newLoc = Lookout._getLocation(tokenDoc);

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

        warpgate.plugin.queueUpdate( async () => {
          await warpgate.event.notify(MODULE[NAME].leaderMoveEvent, data);
        });
      }
      // FOLLOWERS
      if (options.squadronEvent == MODULE[NAME].leaderMoveEvent) {
        
        /* do not respond to our own move events */
        return;
      }

      /* am I a follower? */
      const leaders = tokenDoc.getFlag(MODULE.data.name, MODULE[NAME].leadersFlag) ?? {};
      if (Object.keys(leaders).length > 0){

        /* I am following someone and have moved independently of them -> Pause */
        warpgate.plugin.queueUpdate( async () => {
          await Lookout.pause(tokenDoc);
        });
      }
    }
  }

  static async pause(tokenDoc) {
    await tokenDoc.setFlag(MODULE.data.name,MODULE[NAME].followPause, true);
  }

  static async addFollower(leaderId, followerId, sceneId, 
    orientation = squadron.CONST.QUERY,
    {elevation = true, snap = true} = {}) {

    /* define default result based on inputs */
    let result = {buttons: orientation, inputs: [elevation, snap]}
    if (orientation === squadron.CONST.QUERY) {
      /* ask for orientation */
      const dialogData = {
        inputs: [{
          type: 'checkbox',
          label: MODULE.localize('orientation.lockElevation'),
          options: elevation ?? true
        },{
          type: 'checkbox',
          label: MODULE.localize('orientation.snapLabel'),
          options: snap
        }],
        buttons: [{
          label: MODULE.localize('orientation.left'),
          value: squadron.CONST.LEFT,
        },{
          label: MODULE.localize('orientation.up'),
          value: squadron.CONST.UP,
        },{
          label: MODULE.localize('orientation.down'),
          value: squadron.CONST.DOWN,
        },{
          label: MODULE.localize('orientation.right'),
          value: squadron.CONST.RIGHT,
        },{
          label: MODULE.localize('orientation.none'),
          value: squadron.CONST.NONE,
        }],
      }

      result = await warpgate.menu(dialogData,{title: MODULE.localize('orientation.title')})
    }

    /* dialog was cancelled */
    if (result.buttons === false) return false;
    logger.debug('Behind vector', result);

    const eventData = {
      leaderId,
      followerId,
      sceneId,
      orientationVector: result.buttons, //leader does not care about this
      snap: result.inputs[1],
      locks: {
        planar: result.buttons.none ?? false,
        elevation: result.inputs[0]
      },
      initiator: game.user.id //for informing user of things
    }

    /* trigger all relevant events */
    await warpgate.event.notify(MODULE[NAME].addFollowerEvent, eventData);
    await warpgate.event.notify(MODULE[NAME].addLeaderEvent, eventData);

    return eventData
  }
}
