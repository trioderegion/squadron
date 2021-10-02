/** MIT (c) 2021 DnD5e Helpers */

import { logger } from './modules/logger.js';

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

  static localize(...args){
    return game.i18n.localize(...args);
  }

  static format(...args){
    return game.i18n.format(...args);
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

    if (MODULE.isFirstGM()) return game.user;

    const gmOwners = Object.entries(doc.data.permission)
      .filter(([id,level]) => (game.users.get(id)?.isGM && game.users.get(id)?.active) && level === 3)
      .map(([id, level]) => id);
    const otherOwners = Object.entries(doc.data.permission)
      .filter(([id, level]) => (!game.users.get(id)?.isGM && game.users.get(id)?.active) && level === 3)
      .map(([id, level])=> id);

    if(gmOwners.length > 0) return game.users.get(gmOwners[0]);
    else return game.users.get(otherOwners[0]);
  }

  static isFirstOwner(doc){
    return game.user.id === MODULE.firstOwner(doc)?.id;
  }
}
