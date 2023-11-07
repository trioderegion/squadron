import { MODULE } from './modules/module.mjs';
import { logger } from './modules/logger.mjs';
import { UserInterface } from './modules/user-interface.mjs'
import { Lookout } from './modules/lookout.mjs'
import { Logistics } from './modules/logistics.mjs'
import { api } from './modules/api.mjs'
import Formation from './apps/Formation';

const SUB_MODULES = {
  MODULE,
  UserInterface,
  Lookout,
  Logistics,
  api,
  logger,
  Formation,
}

/*
  Initialize Module
  */
await MODULE.build();

/*
  Initialize all Sub Modules
  */
Hooks.on(`setup`, () => {
  Object.values(SUB_MODULES).forEach(cl => cl.register());
});

