/** MIT (c) 2021 DnD5e Helpers */

import { logger } from './logger.mjs';

const NAME = "squadron";
const PATH = `/modules/${NAME}`;

export class MODULE{
  static async register(){
    logger.info("Initializing Module");
    MODULE.settings();
  }

  static async build(){
    MODULE.data = { 
      name: NAME,
      path: PATH,
      title: "Squadron"
    };
    logger.info("Module Data Built");
  }

  static settings() {

  }

  static setting(key){
    return game.settings.get(MODULE.data.name, key);
  }

  static localize(moduleKey){
    return game.i18n.localize("sqdrn."+moduleKey);
  }

  static format(moduleKey, data){
    return game.i18n.format("sqdrn."+moduleKey, data);
  }

  static firstGM(){
    return game.users.find(u => u.isGM && u.active);
  }

  static isFirstGM(){
    return game.user.id === MODULE.firstGM()?.id;
  }

  static async wait(ms){
    return new Promise((resolve)=> setTimeout(resolve, ms))
  }

  static async waitFor(fn, m = 200, w = 100, i = 0){
    while(!fn(i, ((i*w)/100)) && i < m){
      i++;
      await MODULE.wait(w);
    }
    return i === m ? false : true;
  }


  static applySettings(settingsData){
    Object.entries(settingsData).forEach(([key, data])=> {
      game.settings.register(
        MODULE.data.name, key, {
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
