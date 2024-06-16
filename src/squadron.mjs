import { MODULE } from './modules/module.mjs';
import { UserInterface } from './modules/user-interface.mjs'
import { Lookout } from './modules/lookout.mjs'
import { Logistics } from './modules/logistics.mjs'
import Formation from './apps/Formation';

const SUB_MODULES = {
  MODULE,
  UserInterface,
  Lookout,
  Logistics,
  Formation,
}

globalThis['%config.id%'] = MODULE.api = {
  disband: Logistics.disband,
  Formation,
  follow: Lookout.addFollower,
  stop: UserInterface.stop,
  pause: Lookout.pause,
  resume: UserInterface.resume,
}

/** Initialize all modules */
Hooks.on(`setup`, () => {
  Object.values(SUB_MODULES).forEach(cl => cl.register());
});

