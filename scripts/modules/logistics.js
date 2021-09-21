import { logger } from './logger.js'



export class Logistics {
  
  static followVector(newLoc, oldLoc) {

    let followVector = new Ray(newLoc, oldLoc);

    //const followVector = {
    //  x: ray.x/ray.distance,
    //  y: ray.y/ray.distance
    //}

    logger.debug('Follow Vector', followVector);

    return followVector;
  }

  static shouldRespond(eventData) {
    
    /* are we the first owner of any of the
     *follower tokens?
     */
    const isOwner = eventData.followers.reduce( (sum, curr) => {
      if (sum) return sum;
      const token = game.scenes.get(curr.sceneId).getEmbeddedDocument("Token", curr.tokenId);
      if (MODULE.isFirstOwner(token)) return true;
      return sum;
    },false)

    return isOwner;
  }

  /* followerData[leaderId]={ paused: Boolean, deltaVector: {angle,distance}}
   * where deltaVector is the offset relative
   * to the unit followVector of the leader
   */
  static async _moveFollower( followerId, data ) {

    /* only handle *ours* no matter what anybody says */
    const token = game.scenes.get(followerId.sceneId).getEmbeddedDocument("Token", followerId.tokenId);
    if (MODULE.isFirstOwner(token)) return;

    /* get our follower information */
    const followerData = token.getFlag(MODULE.data.name, MODULE['Lookout']?.followingFlag) ?? {};

    /* are we paused or have improper information? */
    if( (followerData[data.leader.tokenId]?.paused ?? true) ) return;

    const {deltaVector} = followerData[data.leader.tokenId];

    /* from follow vector, calculate our new position */
    const {followVector, finalPosition} = data.leader;

    const newPosition = Logistics._calculateNewPosition(finalPosition, followVector, deltaVector);

    await warpgate.mutate(token, {token: {newPosition}}, {}, {permanent: true});

  }

  /* unit normal is forward */
  static _calculateNewPosition(origin, forwardVector, delta){
    const {angle, distance} = delta; 
    const offsetAngle = forwardVector.angle();
    const newLocation = Ray.fromAngle(origin.x, origin.y, offsetAngle + angle, distance);
    return newLocation.B; 
  }

  static async handleLeaderMove(data) {

    for(const followerId of data.followers){
      await Logistics._moveFollower( followerId, data )
    }
  }

  static calculateFollowerDelta(leaderPos, leaderAngle, followerPos){
    
    const followerVector = {x: followerPos.x - leaderPos.x, y: followerPos.x - leaderPos.y};
    const followerRay = new Ray({x:0, y:0}, followerVector);
    const followerAngle = followerRay.angle();

    return {angle: followerAngle + leaderAngle, distance: followerRay.distance}
  }
}

