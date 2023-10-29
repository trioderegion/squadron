
import { MODULE } from './module.mjs'
import { Lookout } from './lookout.mjs'
import { Logistics } from './logistics.mjs'
import { UserInterface } from './user-interface.mjs'


export class api {

  static register() {
    api.globals();
  }

  static globals() {
    const NAME = MODULE.data.name;
    globalThis[NAME] = {
      disband: Logistics.disband,
      follow: Lookout.addFollower,
      stop: UserInterface.stop,
      pause: Lookout.pause,
      resume: UserInterface.resume,
      get CONST() {
        return {
          LEFT: {x:1, y:0},
          UP: {x:0, y:-1},
          DOWN: {x:0, y:1},
          RIGHT: {x:-1, y:0},
          NONE: {x:0, y:0, none:true},
          SHADOW: {x:-1, y:-1, z:-1, mode:'rel'},
          MIRROR: {x:1, y:1, z:1, mode:'rel'},
          QUERY: true,
        }
      }
    }
  }

}
