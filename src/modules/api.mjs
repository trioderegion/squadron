
import { MODULE } from './module.mjs';
import { Lookout } from './lookout.mjs';
import { Logistics } from './logistics.mjs';
import { UserInterface } from './user-interface.mjs';
import Formation from '../apps/Formation';


export class api {

  static register() {
    api.globals();
  }

  static globals() {
    globalThis['%config.id%'] = {
      disband: Logistics.disband,
      Formation,
      follow: Lookout.addFollower,
      stop: UserInterface.stop,
      pause: Lookout.pause,
      resume: UserInterface.resume,
      get CONST() {
        return {
          LEFT: {x:1, y:0, mode:'vector'},
          UP: {x:0, y:-1, mode:'vector'},
          DOWN: {x:0, y:1, mode:'vector'},
          RIGHT: {x:-1, y:0, mode:'vector'},
          NONE: {x:0, y:0, mode:'static'},
          SHADOW: {x:-1, y:-1, z:-1, mode:'rel'},
          MIRROR: {x:1, y:1, z:1, mode:'rel'},
          QUERY: true,
        }
      },
      get EVENTS() {
        return {
          ...MODULE['Lookout']
        }
      }
    }
  }

}
