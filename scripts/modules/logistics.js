import { logger } from './logger.js'
import { MODULE } from '../module.js'



export class Logistics {
  
  static createFollowVector(newLoc, oldLoc) {

    /* vector is defined as origin at new location
     * pointing towards oldLoc
     */
    const vector = new Ray(newLoc, oldLoc);
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
    return MODULE.isFirstOwner(leader.actor);
  }

  static followerFirstOwner(eventData) {
    const follower = game.scenes.get(eventData.sceneId).getEmbeddedDocument('Token', eventData.followerId);
    return MODULE.isFirstOwner(follower.actor);
  }

  /* followerData[leaderId]={ paused: Boolean, deltaVector: {angle,distance}}
   * where deltaVector is the offset relative
   * to the unit followVector of the leader
   */
  static _moveFollower( followerId, data ) {

    /* only handle *ours* no matter what anybody says */
    const token = game.scenes.get(data.sceneId).getEmbeddedDocument("Token", followerId);
    if (!token || !MODULE.isFirstOwner(token.actor)) return;

    const paused = token.getFlag(MODULE.data.name, MODULE['Lookout'].followPause);

    if (paused) return;

    /* get our follower information */
    const followerData = token.getFlag(MODULE.data.name, MODULE['Lookout']?.leadersFlag) ?? {};

    const deltaInfo = followerData[data.leader.tokenId];

    /* null delta means the leader thinks we are following, but are not */
    if (!deltaInfo){
      logger.debug(`Leader ${data.leader.tokenId} thinks ${token.name} is following, but they disagree`);
      return;
    }

    /* from follow vector, calculate our new position */
    let {followVector, finalPosition} = data.leader;

    if ( typeof followVector !== "Ray" ){
      /* this was serialized from another client */
      followVector = new Ray(followVector.A, followVector.B);
    }

    const {x,y} = Logistics._calculateNewPosition(finalPosition, followVector, deltaInfo);

    return {_id: followerId, x,y};
  }

  /* unit normal is forward */
  static _calculateNewPosition(origin, forwardVector, delta){
    const {angle, distance} = delta; 
    const offsetAngle = forwardVector.angle;
    const newLocation = Ray.fromAngle(origin.x, origin.y, offsetAngle + angle, distance);
    return newLocation.B; 
  }

  /* return {Promise} */
  static handleLeaderMove(data) {

    let updates = data.followers.map( element => Logistics._moveFollower( element, data ) );
    updates = updates.reduce( (sum, curr) => {
      if (!curr) return sum;
      sum.push(curr);
      return sum
    }, []);

    return game.scenes.get(data.sceneId).updateEmbeddedDocuments('Token', updates, {squadronEvent: MODULE['Lookout'].leaderMoveEvent})
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
    const {leaderId, followerId, sceneId, orientationVector} = eventData;

    const scene = game.scenes.get(sceneId);

    const leaderToken = scene.getEmbeddedDocument('Token', leaderId);
    let followerToken = scene.getEmbeddedDocument('Token', followerId);

    const leaderAngle = Logistics._computeLeaderAngle(orientationVector);

    const followerDelta = Logistics._calculateFollowerDelta(leaderToken.data, leaderAngle, followerToken.data);

    let currentFollowInfo = duplicate(followerToken.getFlag(MODULE.data.name, MODULE['Lookout'].leadersFlag) ?? {});

    /* stamp in our new data */
    currentFollowInfo[leaderId] = followerDelta;

    /* store the data */
    await followerToken.setFlag(MODULE.data.name, MODULE['Lookout'].leadersFlag, currentFollowInfo);
    await followerToken.setFlag(MODULE.data.name, MODULE['Lookout'].followPause, false);

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

