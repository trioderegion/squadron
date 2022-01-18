import { logger } from './logger.js'
import { MODULE } from '../module.js'

class FollowVector extends Ray {
  constructor( A, B ) {
    super( A, B );

    /**
     * The origin z-coordinate
     * @type {number}
     */
    this.z0 = A.z;

    /**
     * The "up" distance of the ray, z1 - z0
     * @type {number}
     */
    this.dz = B.z - A.z;
  }
}

export class Logistics {

  static register() {
    this.settings();
  }

  static settings() {
    const config = true;
    const settingsData = {
      collideWalls : {
        scope: "world", config, default: false, type: Boolean,
      },
    };

    MODULE.applySettings(settingsData);
  }
  
  static createFollowVector(newLoc, oldLoc) {

    /* vector is defined as origin at new location
     * pointing towards oldLoc
     */
    const vector = new FollowVector(newLoc, oldLoc);
    logger.debug('Follow Vector', vector);
    return vector;
  }

  static containsOwnedFollower(eventData) {
    
    /* are we the first owner of any of the
     *follower tokens that are not paused?
     */
    const isOwner = eventData.followers.reduce( (sum, curr) => {
      if (sum) return sum;
      const token = game.scenes.get(eventData.sceneId).getEmbeddedDocument("Token", curr);
      if (!token) return sum;
      const paused = token.getFlag(MODULE.data.name, MODULE['Lookout'].followPause) ?? true;
      if (MODULE.isFirstOwner(token.actor) && !paused) return true;
      return sum;
    },false)

    return isOwner;
  }

  static leaderFirstOwner(eventData) {
    const leader = game.scenes.get(eventData.sceneId).getEmbeddedDocument('Token', eventData.leaderId);
    return MODULE.isFirstOwner(leader?.actor);
  }

  static followerFirstOwner(eventData) {
    const follower = game.scenes.get(eventData.sceneId).getEmbeddedDocument('Token', eventData.followerId);
    return MODULE.isFirstOwner(follower?.actor);
  }

  /* followerData[leaderId]={angle,distance}}
   * where deltaVector is the offset relative
   * to the unit followVector of the leader
   */
  static _moveFollower( followerId, data ) {

    /* only handle *ours* no matter what anybody says */
    const token = game.scenes.get(data.sceneId).getEmbeddedDocument("Token", followerId);
    if (!token || !MODULE.isFirstOwner(token?.actor)) return;

    const paused = token.getFlag(MODULE.data.name, MODULE['Lookout'].followPause);

    if (paused) return;

    /* get our follower information */
    const followerData = token.getFlag(MODULE.data.name, MODULE['Lookout']?.leadersFlag) ?? {};

    const {delta: deltaInfo, locks} = followerData[data.leader.tokenId];

    /* null delta means the leader thinks we are following, but are not */
    if (!deltaInfo){
      logger.debug(`Leader ${data.leader.tokenId} thinks ${token.name} is following, but they disagree`);
      return;
    }

    /* from follow vector, calculate our new position */
    let {followVector, finalPosition} = data.leader;

    if ( typeof followVector !== "FollowVector" ){
      /* this was serialized from another client */
      followVector = new FollowVector(followVector.A, followVector.B);
    }

    /* record last user in case of collision */
    const user = token.getFlag(MODULE.data.name, MODULE['Lookout']?.lastUser) ?? {};

    /* get follower token size offset (translates center to corner) */
    const offset = {x: -token.object.w/2, y: -token.object.h/2, z: 0};
    const position = Logistics._calculateNewPosition(finalPosition, followVector, deltaInfo, locks, offset);
    
    let moveInfo = {update: {_id: followerId, ...position}, stop: false, user, name: token.name};

    /* if we should check for wall collisions, do that here */
    //Note: we can only check (currently) if the most senior owner is on
    //      the same scene as the event. 
    if(MODULE.setting('collideWalls') && canvas.scene.id === data.sceneId) {
      //get centerpoint offset
      const offset = {x: token.object.center.x - token.data.x, y: token.object.center.y - token.data.y};
      moveInfo.stop = Logistics._hasCollision([token.data.x+offset.x, token.data.y+offset.y, moveInfo.update.x+offset.x, moveInfo.update.y+offset.y]);
      
    }

    return moveInfo;
  }

  /* checks for wall collision along the array form of a ray */
  static _hasCollision(points) {
    const ray = new Ray({x: points[0], y: points[1]}, {x: points[2], y: points[3]});
    return canvas.walls.checkCollision(ray)
  }

  /* unit normal is forward */
  static _calculateNewPosition(origin, forwardVector, delta, locks, offset){
    const {angle, distance, dz, orientation} = delta; 
    const offsetAngle = forwardVector.angle;

    /* if planar locked preserve initial orientation */
    const finalAngle = locks.planar ? (new Ray({x:0,y:0}, orientation)).angle + angle : offsetAngle + angle;

    const newLocation = Ray.fromAngle(origin.x, origin.y, finalAngle, distance);

    let pos = {};
    

    //if (forwardVector.dx || forwardVector.dy) {
      pos.x = newLocation.B.x + offset.x;
      pos.y = newLocation.B.y + offset.y;
    //}

    if (forwardVector.dz) {
      pos.elevation = locks.elevation ? origin.z + dz : forwardVector.dz > 0 ? origin.z - dz : origin.z + dz
    }

    return pos;
  }

  /* return {Promise} */
  static async handleLeaderMove(data) {

    const updates = data.followers.map( element => Logistics._moveFollower( element, data ) );
    const moves = updates.reduce( (sum, curr) => {
      if (curr?.stop ?? true) return sum;
      sum.push(curr.update);
      return sum
    }, []);

    let collisions = [];

    for (const curr of updates) {
      if(curr?.stop) {
        collisions.push({_id: curr.update._id, [`flags.${MODULE.data.name}.paused`]: true})

        /* notify initiating owner of collision */
        warpgate.event.notify(MODULE['Lookout'].notifyCollision, {tokenId: curr.update._id, tokenName: curr.name, user: curr.user} )
      }
    }
    
    logger.debug('moves', moves, 'collisions', collisions);

    await game.scenes.get(data.sceneId).updateEmbeddedDocuments('Token', collisions, {squadronEvent: MODULE['Lookout'].leaderMoveEvent});

    return game.scenes.get(data.sceneId).updateEmbeddedDocuments('Token', moves, {squadronEvent: MODULE['Lookout'].leaderMoveEvent})
  }

  static async handleRemoveFollower(eventData) {
    const leader = game.scenes.get(eventData.sceneId).getEmbeddedDocument('Token', eventData.leaderId);

    const leaderData = (leader.getFlag(MODULE.data.name, MODULE['Lookout'].followersFlag) ?? []);

    /* get new list of followers */
    const newData = leaderData.reduce( (sum, curr) => {
      if (curr == eventData.followerId) return sum;
      sum.push(curr);
      return sum
    }, []);

    if (newData.length > 0) {
      await leader.setFlag(MODULE.data.name, MODULE['Lookout'].followersFlag, newData);
    } else {
      /* no more followers for this leader */
      await leader.unsetFlag(MODULE.data.name, MODULE['Lookout'].followersFlag);
    }
  }

  static announceStopFollow(tokenDoc) {

    const leaders = tokenDoc.getFlag(MODULE.data.name, MODULE['Lookout'].leadersFlag) ?? {};
    if (Object.keys(leaders).length > 0){

      logger.debug('Notifying leaders of follower remove. Follower:', tokenDoc, 'Leaders:', leaders);
      /* notify each leader that one of their followers is being removed */
      Object.keys(leaders).forEach( (leaderId) => {
        warpgate.plugin.queueUpdate( () => {
          return warpgate.event.notify(MODULE['Lookout'].removeFollowerEvent,
            {
              leaderId,
              followerId: tokenDoc.id,
              sceneId: tokenDoc.parent.id
            });
        });

      });

    }
  }

  static async handleRemoveLeader(eventData) {
    const follower = game.scenes.get(eventData.sceneId).getEmbeddedDocument('Token', eventData.followerId);

    await follower.unsetFlag(MODULE.data.name, MODULE['Lookout'].leadersFlag);
    await follower.unsetFlag(MODULE.data.name, MODULE['Lookout'].followPause);
  }

  
  /* leaderData = [follower ids] */
  static async handleAddFollower(eventData) {
    
    /* get the current follower flags */
    const leader = game.scenes.get(eventData.sceneId).getEmbeddedDocument('Token', eventData.leaderId);
    let leaderData = duplicate(leader.getFlag(MODULE.data.name, MODULE['Lookout'].followersFlag) ?? []);

    /* are they already following? */
    if (leaderData.includes(eventData.followerId)) return; 

    leaderData.push(eventData.followerId);

    await leader.setFlag(MODULE.data.name, MODULE['Lookout'].followersFlag, leaderData);
  }

  static async handleAddLeader(eventData) {
    const {leaderId, followerId, sceneId, orientationVector, locks, initiator} = eventData;

    const scene = game.scenes.get(sceneId);

    const leaderToken = scene.getEmbeddedDocument('Token', leaderId);
    let followerToken = scene.getEmbeddedDocument('Token', followerId);

    const followerDelta = Logistics._calculateFollowerDelta(leaderToken.object, orientationVector, followerToken.object);

    let currentFollowInfo = duplicate(followerToken.getFlag(MODULE.data.name, MODULE['Lookout'].leadersFlag) ?? {});

    /* stamp in our new data */
    currentFollowInfo[leaderId] = { delta: followerDelta, locks };

    const squadron = {
      [MODULE['Lookout'].leadersFlag] : currentFollowInfo,
      [MODULE['Lookout'].followPause]: false,
      [MODULE['Lookout'].lastUser]: initiator
    }

    /* store the data */
    await followerToken.update({'flags': {squadron}});
  }

  static _computeLeaderAngle(orientationVector) {
    const ray = new Ray({x: 0, y:0}, orientationVector);
    return ray.angle;
  }

  static _calculateFollowerDelta(leaderPlaceable, orientationVector, followerPlaceable){
    
    const leaderAngle = Logistics._computeLeaderAngle(orientationVector);

    const followerVector = {x: followerPlaceable.x - leaderPlaceable.x, y: followerPlaceable.y - leaderPlaceable.y};
    const followerRay = new Ray({x:0, y:0}, followerVector);
    const followerAngle = followerRay.angle;

    return {angle: followerAngle + leaderAngle, distance: followerRay.distance, dz: followerPlaceable.data.elevation - leaderPlaceable.data.elevation, orientation: orientationVector}
  }

  /* Will erase all squadron data from all scenes (if parameter == true) or
   * just the currently viewed scene (if false).
   */
  static disband(global = false) {

    if (global) {
      game.scenes.forEach( (scene) => {
        warpgate.plugin.queueUpdate( () => { return Logistics._disbandScene(scene) } )
      });
    } else {
      warpgate.plugin.queueUpdate( () => { return Logistics._disbandScene(canvas.scene) });
    }
  }

  static _disbandScene(scene) {
    const tokens = scene.getEmbeddedCollection('Token').filter( token => token.data.flags?.squadron );
    const updates = tokens.map( (token) => {return { _id: token.id, 'flags.-=squadron':null}});
    return scene.updateEmbeddedDocuments('Token', updates);
  }
}

