import { MODULE } from './module.mjs'

export class FollowVector extends Ray {
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
      collideWalls: {
        scope: "world", config, default: 0, type: Number,
        choices: {
          0: "sqdrn.setting.collideWalls.cOff",
          1: "sqdrn.setting.collideWalls.cPause",
          2: "sqdrn.setting.collideWalls.cTeleport",
        }
      },
    };

    MODULE.applySettings(settingsData);
  }
  
  /**
   *
   * @example
   * ```json
   * {
   *  "leader": {
   *      "tokenId": "br5CLQqneLsRA8dG",
   *      "sceneId": "kjgFSuEJMBUH0gq4",
   *      "followVector": {
   *          "A": {
   *              "x": 1350,
   *              "y": 850,
   *              "z": 0
   *          },
   *          "B": {
   *              "x": 1450,
   *              "y": 950,
   *              "z": 0
   *          },
   *          "y0": 850,
   *          "x0": 1350,
   *          "dx": 100,
   *          "dy": 100,
   *          "slope": 1,
   *          "z0": 0,
   *          "dz": 0
   *      }
   *  },
   *  "followers": [
   *      "o6jXMX22dnYljtVN"
   *  ],
   *  "userId": "dZNkKae5pRvEOgcB"
   * }
   *```
   */

  static containsOwnedFollower(eventData) {
    
    /* are we the first owner of any of the
     *follower tokens that are not paused?
     */
    const isOwner = eventData.followers.reduce( (sum, curr) => {
      if (sum) return sum;
      const token = game.scenes.get(eventData.leader.sceneId).getEmbeddedDocument("Token", curr);
      if (!token) return sum;
      if (MODULE.isFirstOwner(token.actor)) return true;
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
   *
   * @param {object} data  {
          leader: {
            tokenId: tokenDoc.id,
            sceneId: tokenDoc.parent.id,
            finalPosition: newLoc,
            followVector
          },
          followers,
        }
   */
  static _moveFollower( followerId, data ) {

    /* only handle *ours* no matter what anybody says */
    const token = game.scenes.get(data.leader.sceneId).getEmbeddedDocument("Token", followerId);
    if (!token || !MODULE.isFirstOwner(token?.actor)) return;

    /* get our follower information */
    const followerData = token.getFlag('%config.id%', MODULE.FLAG.leaders) ?? {};

    const {delta: deltaInfo, locks, snap} = followerData[data.leader.tokenId] ?? {delta: null};

    /* have i moved independently and am generally paused? */
    const paused = token.getFlag('%config.id%', MODULE.FLAG.paused);

    /* is this _specific_ leader marked as a persistent follow? */
    if (paused && !locks.follow) return;

    /* null delta means the leader thinks we are following, but are not */
    if (!deltaInfo){
      //console.debug(`Leader ${data.leader.tokenId} thinks ${token.name} is following, but they disagree`);
      MODULE.comms.emit(MODULE.EVENT.removeFollower, {
          leaderId: data.leader.tokenId,
          followerId,
          sceneId: data.leader.sceneId
        });

      return;
    }

    /* from follow vector, calculate our new position */
    let {followVector} = data.leader;

    if ( !(followVector instanceof FollowVector) ){
      /* this was serialized from another client */
      followVector = new FollowVector(followVector.A, followVector.B);
    }

    /* record last user in case of collision */
    const user = token.getFlag('%config.id%', MODULE.FLAG.lastUser) ?? {};

    /* get follower token size offset (translates center to corner) */
    let position = Logistics._calculateNewPosition(followVector, deltaInfo, locks, token);
    foundry.utils.mergeObject(position, {x: token.x, y: token.y}, {overwrite: false});

    /* snap to the grid if requested.*/
    if (snap) {
      foundry.utils.mergeObject(position, token.parent.grid.getSnappedPoint(position, {mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_CORNER}));
    }

    /* check if we have moved -- i.e. on the 2d canvas */
    const isMove = position.x != token.x || position.y != token.y

    let moveInfo = {update: {_id: followerId, ...position}, stop: false, user, name: token.name};

    /* if we should check for wall collisions, do that here */
    //Note: we can only check (currently) if the most senior owner is on
    //      the same scene as the event. 
    if((MODULE.setting('collideWalls') > 0) && canvas.scene.id === data.leader.sceneId && isMove) {
      //get centerpoint offset
      const offset = {x: token.object.center.x - token.x, y: token.object.center.y - token.y};
      moveInfo.stop = Logistics._hasCollision([token.x+offset.x, token.y+offset.y, moveInfo.update.x+offset.x, moveInfo.update.y+offset.y]);
      
    }

    return moveInfo;
  }

  /* checks for wall collision along the array form of a ray */
  static _hasCollision(points) {
    const origin = {x: points[0], y: points[1]};
    const destination = {x: points[2], y: points[3]};
    return CONFIG.Canvas.polygonBackends.move.testCollision(origin, destination, {mode:"any", type:"move"});
  }

  /* unit normal is forward */
  static _calculateNewPosition(forwardVector, delta, locks, token){
    const origin = forwardVector.A;
    const {angle, distance, dz, orientation} = delta; 
    let pos = {};

    /* Compute X/Y depending on mode */
    if (delta.orientation.mode == 'rel') {
      pos.x = token.x + orientation.x * forwardVector.dx;
      pos.y = token.y + orientation.y * forwardVector.dy;
    } else {
      const offsetAngle = forwardVector.angle;

      /* if planar locked preserve initial orientation */
      const finalAngle = offsetAngle + angle;

      const newLocation = Ray.fromAngle(origin.x, origin.y, finalAngle, distance);

      // give x/y if any 2d movement occured
      if (forwardVector.dx || forwardVector.dy){
        const {height, width} = MODULE.getSize(token);
        pos.x = newLocation.B.x - width/2;
        pos.y = newLocation.B.y - height/2;
      }

    }

    /* compute elevation change depending on its mode */
    if (forwardVector.dz) {
      switch (locks.elevation) {
        case 'static':
          break;
        case 'offset':
          pos.elevation = origin.z + dz;
          break;
        case 'tether':
          pos.elevation = forwardVector.dz > 0 ? origin.z - dz : origin.z + dz
          break;
      }
    }

    return pos;

  }

  /* return {Promise} */
  static async handleLeaderMove(eventData) {

    if (!Logistics.containsOwnedFollower(eventData)) return;

    const stopSetting = MODULE.setting('collideWalls') == 1;
    const updates = eventData.followers.map( element => Logistics._moveFollower( element, eventData ) );
    const leader = await fromUuid(`Scene.${eventData.leader.sceneId}.Token.${eventData.leader.tokenId}`);
    const leaderSize = MODULE.getSize(leader);
    const sortedActions = updates.reduce( (acc, curr) => {
      if (curr?.stop === false) {
        acc.moves.push(curr.update);
        return acc;
      }

      if (curr?.stop === true) {
        if (stopSetting) {
          acc.stops.push({
            _id: curr.update._id, 
            [`flags.%config.id%.${MODULE.FLAG.paused}`]: true
          });
        } else{
          acc.teleports.push({
            ...curr.update,
            x: eventData.leader.followVector.A.x - leaderSize.width / 2 + 10 + acc.teleports.length * 10,
            y: eventData.leader.followVector.A.y - leaderSize.height / 2 + 10 + acc.teleports.length * 10,
          });
        }
      }

      return acc;
    }, {moves: [], stops: [], teleports: []});

    for (const curr of sortedActions.stops) {
      /* notify initiating owner of collision */
      await MODULE.comms.emit(MODULE.EVENT.notifyCollision, {
        tokenId: curr.update._id,
        tokenName: curr.name,
        user: curr.user
      })
    }

    await game.scenes.get(eventData.leader.sceneId).updateEmbeddedDocuments('Token', sortedActions.stops, {squadronEvent: MODULE.EVENT.leaderMove});

    await game.scenes.get(eventData.leader.sceneId).updateEmbeddedDocuments('Token', sortedActions.teleports, {teleport: true, squadronEvent: MODULE.EVENT.leaderMove})

    return game.scenes.get(eventData.leader.sceneId).updateEmbeddedDocuments('Token', sortedActions.moves, {squadronEvent: MODULE.EVENT.leaderMove})
  }

  static async handleRemoveFollower(eventData) {

    if (!Logistics.leaderFirstOwner(eventData)) return;

    const leader = game.scenes.get(eventData.sceneId).getEmbeddedDocument('Token', eventData.leaderId);

    const leaderData = (leader.getFlag('%config.id%', MODULE.FLAG.followers) ?? []);

    /* get new list of followers */
    const newData = leaderData.reduce( (sum, curr) => {
      if (curr == eventData.followerId) return sum;
      sum.push(curr);
      return sum
    }, []);

    if (newData.length > 0) {
      await leader.setFlag('%config.id%', MODULE.FLAG.followers, newData);
    } else {
      /* no more followers for this leader */
      await leader.unsetFlag('%config.id%', MODULE.FLAG.followers);
    }
  }

  /**
   * @returns {Promise|undefined}
   */
  static announceStopFollow(tokenDoc) {

    const leaders = tokenDoc.getFlag('%config.id%', MODULE.FLAG.leaders) ?? {};
    if (Object.keys(leaders).length > 0){

      //console.debug('Notifying leaders of follower remove. Follower:', tokenDoc, 'Leaders:', leaders);
      /* notify each leader that one of their followers is being removed */
      return Promise.all(Object.keys(leaders).map( (leaderId) => {
        return MODULE.comms.emit(MODULE.EVENT.removeFollower,
          {
            leaderId,
            followerId: tokenDoc.id,
            sceneId: tokenDoc.parent.id
          });
      }));

    }
  }

  static async handleRemoveLeader(eventData) {

    if (!Logistics.followerFirstOwner(eventData)) return;

    const follower = game.scenes.get(eventData.sceneId).getEmbeddedDocument('Token', eventData.followerId);

    await follower.update({
      [`flags.%config.id%.-=${MODULE.FLAG.leaders}`]: null,
      [`flags.%config.id%.-=${MODULE.FLAG.paused}`]: null
    });

  }

  
  /* leaderData = [follower ids] */
  static async handleAddFollower(eventData) {

    if (!Logistics.leaderFirstOwner(eventData)) return;
    
    /* get the current follower flags */
    const leader = game.scenes.get(eventData.sceneId).getEmbeddedDocument('Token', eventData.leaderId);
    let leaderData = foundry.utils.duplicate(leader.getFlag('%config.id%', MODULE.FLAG.followers) ?? []);

    /* are they already following? */
    if (leaderData.includes(eventData.followerId)) return; 

    leaderData.push(eventData.followerId);

    await leader.setFlag('%config.id%', MODULE.FLAG.followers, leaderData);
  }

  static async handleAddLeader(eventData) {

    if (!Logistics.followerFirstOwner(eventData)) return;

    const {leaderId, followerId, sceneId, orientationVector, locks, initiator, snap} = eventData;

    const scene = game.scenes.get(sceneId);

    const leaderToken = scene.getEmbeddedDocument('Token', leaderId);
    let followerToken = scene.getEmbeddedDocument('Token', followerId);

    const followerDelta = Logistics._calculateFollowerDelta(leaderToken.object, orientationVector, followerToken.object);

    let currentFollowInfo = foundry.utils.duplicate(followerToken.getFlag('%config.id%', MODULE.FLAG.leaders) ?? {});

    /* stamp in our new data */
    currentFollowInfo[leaderId] = { delta: followerDelta, locks, snap };

    const flags = {
      [MODULE.FLAG.leaders] : currentFollowInfo,
      [MODULE.FLAG.paused]: false,
      [MODULE.FLAG.lastUser]: initiator,
    }

    /* store the data */
    await followerToken.update({'flags.%config.id%': flags});
  }

  static _computeLeaderAngle(orientationVector) {
    const ray = new Ray({x: 0, y:0}, orientationVector);
    return ray.angle;
  }

  static _calculateFollowerDelta(leaderPlaceable, orientationVector, followerPlaceable){
    
    const leaderAngle = Logistics._computeLeaderAngle(orientationVector);

    const followerVector = {x: followerPlaceable.center.x - leaderPlaceable.center.x, y: followerPlaceable.center.y - leaderPlaceable.center.y};
    const followerRay = new Ray({x:0, y:0}, followerVector);
    const followerAngle = followerRay.angle;

    return {angle: followerAngle + leaderAngle, distance: followerRay.distance, dz: followerPlaceable.document.elevation - leaderPlaceable.document.elevation, orientation: orientationVector}
  }

  /* Will erase all squadron data from all scenes (if parameter == true) or
   * just the currently viewed scene (if false).
   */
  static disband(global = false) {

    if (global) {
      game.scenes.forEach( (scene) => {
        Logistics._disbandScene(scene);
      });
    } else {
      return Logistics._disbandScene(canvas.scene);
    }
  }

  static _disbandScene(scene) {
    const tokens = scene.getEmbeddedCollection('Token').filter( token => token.flags?.['%config.id%'] );
    const updates = tokens.map( (token) => {return { _id: token.id, 'flags.-=%config.id%':null}});
    return scene.updateEmbeddedDocuments('Token', updates);
  }
}

