
import { MODULE } from '../module.js'
import { Logistics } from './logistics.js'

const NAME = 'Lookout';


export class Lookout {

  static register() {
    Lookout.defaults();
    Lookout.hooks();
    Lookout.settings();
  }

  static hooks() {
    Hooks.on('preUpdateToken', Lookout._preUpdateToken);
    warpgate.event.watch(MODULE[NAME].eventName, Logistics.handleLeaderMove, Logistics.shouldRespond);
  }

  static defaults() {
    MODULE[NAME] = {
      eventName: 'sq-leader-move',
      followersFlag: 'followers',
      followingFlag: 'following'
    }
  }

  static settings() {

  }

  static _preUpdateToken(tokenDoc, update) {
    if(update.x || update.y) {

      /* am I a leader? */
      const followers = tokenDoc.getFlag(MODULE.data.name, MODULE[NAME].followersFlag) ?? []
      if (followers.length == 0) return;

      const oldLoc = {
        x: tokenDoc.data.x,
        y: tokenDoc.data.y
      }

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
      
      warpgate.event.notify(MODULE[NAME].eventName, data);
    }
  }

  // @TODO handle establishing leader/follower pair
}
