
import { MODULE } from '../module.js'
import { Lookout } from './lookout.js'
import { Logistics } from './logistics.js'
import { UserInterface } from './user-interface.js'


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
      CONST: {
        LEFT: {x:1, y:0},
        UP: {x:0, y:-1},
        DOWN: {x:0, y:1},
        RIGHT: {x:-1, y:0},
        NONE: {x:0, y:0, none:true},
        QUERY: true,
      }
    }
  }

}
