

import { MODULE } from '../module.js'
import { Logistics } from './logistics.js'

const NAME = 'UserInterface';

export class UserInterface {

  static register() {
    UserInterface.hooks();
  }

  static hooks(){
    Hooks.on('renderTokenHUD', UserInterface._renderTokenHUD);
  }

  static _renderTokenHUD(app, html, data){
    UserInterface._addFollowLeader(html, data);
  }

  static _addFollowLeader(html, data) {

    const button = $(`<div class="control-icon squadron" title="text"><i class="fas fa-anchor"></i></div>`);

    const followerTokenData = data;
    if (!followerTokenData) return;

    button.click( (event) => {
      UserInterface._targetLeader(followerTokenData);
    });

    const column = '.col.left';
    html.find(column).append(button);
  }

  static _targetLeader(followerToken) {

    const onTarget = (user, token, active) => {
      if(!active){
        /* we are deslecting something, keep ourselves active */
        Hooks.once('targetToken', onTarget);
        return;
      }

      ui.notifications.info(`${token.name} is being followed by ${followerToken.name}`);

      game.user.updateTokenTargets();

      /* switch back to select */
      UserInterface._activateTool(canvas.tokens, 'select');  

      return false;
     
    };

    Hooks.once('targetToken', onTarget);
    UserInterface._activateTool(canvas.tokens, 'target');
  }

  static _activateTool(layer, toolName) {
    layer.activate();
    ui.controls.control.activeTool = toolName;
    ui.controls.render();
  }


}
