import Comms from "../lib/Comms";

export class MODULE {

  /**
   * Singleton socket manager
   */
  static comms = new Comms();

  /**
   * Populated at runtime
   */
  static api = null;
  static EVENT = Object.freeze({
    leaderMove: "sq-leader-move",
    followerPause: "sq-follow-pause",
    addFollower: "sq-add-follower",
    addLeader: "sq-add-leader",
    removeFollower: "sq-remove-follower",
    removeLeader: "sq-remove-leader",
    notifyCollision: "sq-notify-collision",  
  });

  static CONST = Object.freeze({
    LEFT: Object.freeze({x:1, y:0, mode:'vector'}),
    UP: Object.freeze({x:0, y:-1, mode:'vector'}),
    DOWN: Object.freeze({x:0, y:1, mode:'vector'}),
    RIGHT: Object.freeze({x:-1, y:0, mode:'vector'}),
    SHADOW: Object.freeze({x:-1, y:-1, z:-1, mode:'rel'}),
    MIRROR: Object.freeze({x:1, y:1, z:1, mode:'rel'}),
    QUERY: true,
  })

  static FLAG = Object.freeze({
    followers: "followers",
    leaders: "leaders",
    paused: "paused",
    lastUser: "user",
  })

  static register(){
    this.comms.init();
  }

  static setting(key){
    return game.settings.get('%config.id%', key);
  }

  static localize(moduleKey){
    return game.i18n.localize("sqdrn."+moduleKey);
  }

  static format(moduleKey, data = {}){
    return game.i18n.format("sqdrn."+moduleKey, data);
  }

  static firstGM(){
    return game.users.find(u => u.isGM && u.active);
  }

  static isFirstGM(){
    return game.user.id === MODULE.firstGM()?.id;
  }

  static getSize(tokenDoc) {
    if (tokenDoc.object) return tokenDoc.object.getSize();
    
    let {width, height} = tokenDoc;
    const grid = tokenDoc.parent.grid;
    if ( grid.isHexagonal ) {
      if ( grid.columns ) width = (0.75 * Math.floor(width)) + (0.5 * (width % 1)) + 0.25;
      else height = (0.75 * Math.floor(height)) + (0.5 * (height % 1)) + 0.25;
    }
    width *= grid.sizeX;
    height *= grid.sizeY;
    return {width, height};
  }

  static applySettings(settingsData){
    Object.entries(settingsData).forEach(([key, data])=> {
      game.settings.register(
        '%config.id%', key, {
          name : MODULE.localize(`setting.${key}.name`),
          hint : MODULE.localize(`setting.${key}.hint`),
          ...data
        }
      );
    });
  }

  /* biases toward GM taking action, fallback to individual owners */
  static firstOwner(doc){
    /* null docs could mean an empty lookup, null docs are not owned by anyone */
    if (!doc) return false;

    /* Any GM 'owns' everything */
    const gmOwners = game.users.filter( user => user.isGM && user.active)

    if(gmOwners.length > 0) return gmOwners[0];

    /* users are only owners with permission level 3 */
    const otherOwners = Object.entries(doc.data.permission)
      .filter(([id, level]) => (!game.users.get(id)?.isGM && game.users.get(id)?.active) && level === 3)
      .map(([id, level])=> id);


    return game.users.get(otherOwners[0]);
  }

  static isFirstOwner(doc){
    return game.user.id === MODULE.firstOwner(doc)?.id;
  }
}
