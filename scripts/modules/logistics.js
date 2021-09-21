import { logger } from './logger.js'
import { MODULE } from '../module.js'



export class Logistics {
  
  static createFollowVector(newLoc, oldLoc) {

    let vector = new Ray(newLoc, oldLoc);

    //const followVector = {
    //  x: ray.x/ray.distance,
    //  y: ray.y/ray.distance
    //}

    logger.debug('Follow Vector', vector);

    return vector;
  }

  static containsOwnedFollower(eventData) {
    
    /* are we the first owner of any of the
     *follower tokens?
     */
    const isOwner = eventData.followers.reduce( (sum, curr) => {
      if (sum) return sum;
      const token = game.scenes.get(eventData.sceneId).getEmbeddedDocument("Token", curr);
      if (MODULE.isFirstOwner(token.actor)) return true;
      return sum;
    },false)

    return isOwner;
  }

  static tokenFirstOwner(eventData) {
    const leader = game.scenes.get(eventData.sceneId).getEmbeddedDocument('Token', eventData.leaderId);
    return MODULE.isFirstOwner(leader.actor);
  }

  /* followerData[leaderId]={ paused: Boolean, deltaVector: {angle,distance}}
   * where deltaVector is the offset relative
   * to the unit followVector of the leader
   */
  static async _moveFollower( followerId, data ) {

    /* only handle *ours* no matter what anybody says */
    const token = game.scenes.get(data.sceneId).getEmbeddedDocument("Token", followerId);
    if (!MODULE.isFirstOwner(token.actor)) return;

    /* get our follower information */
    const followerData = token.getFlag(MODULE.data.name, MODULE['Lookout']?.followingFlag) ?? {};

    /* are we paused or have improper information? */
    if( (followerData.paused ?? true) ) return;

    const deltaInfo = followerData[data.leader.tokenId];

    /* from follow vector, calculate our new position */
    const {followVector, finalPosition} = data.leader;

    const {x,y} = Logistics._calculateNewPosition(finalPosition, followVector, deltaInfo);

    //warpgate.plugin.queueUpdate( async ()=>{
    //  await token.update({x, y});
    //});
    
    await warpgate.mutate(token, {token: {x,y}}, {}, {permanent: true});

  }

  /* unit normal is forward */
  static _calculateNewPosition(origin, forwardVector, delta){
    const {angle, distance} = delta; 
    const offsetAngle = forwardVector.angle;
    const newLocation = Ray.fromAngle(origin.x, origin.y, offsetAngle + angle, distance);
    return newLocation.B; 
  }

  static async handleLeaderMove(data) {

    for(const followerId of data.followers){
      await Logistics._moveFollower( followerId, data )
    }
  }

  /* leaderData = [follower ids] */
  static handleAddFollower(eventData) {
    
    /* get the current follower flags */
    const leader = game.scenes.get(eventData.sceneId).getEmbeddedDocument('Token', eventData.leaderId);
    let leaderData = duplicate(leader.getFlag(MODULE.data.name, MODULE['Lookout'].followersFlag) ?? []);

    /* are they already following? */
    if (leaderData.includes(eventData.followerId)) return; 

    leaderData.push(eventData.followerId);

    return leader.setFlag(MODULE.data.name, MODULE['Lookout'].followersFlag, leaderData);
  }

  static handleAddLeader(eventData) {
    const {leaderId, followerId, sceneId, orientationVector} = eventData;

    const scene = game.scenes.get(sceneId);

    const leaderToken = scene.getEmbeddedDocument('Token', leaderId);
    let followerToken = scene.getEmbeddedDocument('Token', followerId);

    const leaderAngle = Logistics._computeLeaderAngle(orientationVector);

    const followerDelta = Logistics._calculateFollowerDelta(leaderToken.data, leaderAngle, followerToken.data);

    let currentFollowInfo = duplicate(followerToken.getFlag(MODULE.data.name, MODULE['Lookout'].followingFlag) ?? {paused: false});

    /* if we are adding a leader, its assumed we wanna follow them, right? */
    currentFollowInfo.paused = false;

    /* stamp in our new data */
    currentFollowInfo[leaderId] = followerDelta;

    /* store the data */
    followerToken.setFlag(MODULE.data.name, MODULE['Lookout'].followingFlag, currentFollowInfo);

  }

  static _computeLeaderAngle(orientationVector) {
    const ray = new Ray({x: 0, y:0}, orientationVector);
    return ray.angle;
  }

  static _calculateFollowerDelta(leaderPos, leaderAngle, followerPos){
    
    const followerVector = {x: followerPos.x - leaderPos.x, y: followerPos.y - leaderPos.y};
    const followerRay = new Ray({x:0, y:0}, followerVector);
    const followerAngle = followerRay.angle;

    return {angle: followerAngle + leaderAngle, distance: followerRay.distance}
  }
}

