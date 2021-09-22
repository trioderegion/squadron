

import { MODULE } from '../module.js'
import { Logistics } from './logistics.js'
import { Lookout } from './lookout.js'

const NAME = 'UserInterface';

export class UserInterface {

  static register() {
    UserInterface.hooks();
  }

  static hooks(){
    Hooks.on('renderTokenHUD', UserInterface._renderTokenHUD);
  }

  static _renderTokenHUD(app, html, data){
    UserInterface._addFollowLeader(html, app?.object?.document);
    UserInterface._addResumeFollow(html, app?.object?.document); 
    UserInterface._addStopFollow(html, app?.object?.document);
  }

  static _addStopFollow(html, selectedToken) {
    if (!selectedToken) return;

    /* am I following anyone? */
    const leaders = selectedToken.getFlag(MODULE.data.name, MODULE['Lookout'].leadersFlag) ?? {};
    if (Object.keys(leaders).length == 0) return;

    const button = $(`<div class="control-icon squadron" title="Stop Following"><i class="fas fa-users-slash"></i></div>`);

    button.click( (event) => {
      UserInterface._stopFollow(selectedToken);
    });

    const column = '.col.right';
    html.find(column).append(button);

  }

  static _addFollowLeader(html, selectedToken) {

    if (!selectedToken) return;

    const button = $(`<div class="control-icon squadron" title="Pick Leader"><i class="fas fa-users"></i></div>`);

    button.click( (event) => {
      UserInterface._targetLeader(selectedToken);
    });

    const column = '.col.left';
    html.find(column).append(button);
  }

  static _addResumeFollow(html, selectedToken) {
    if (!selectedToken) return;

    /* only add this button if we are paused */
    const paused = selectedToken.getFlag(MODULE.data.name, MODULE['Lookout'].followPause) ?? false;
    if (!paused) return;

    const button = $(`<div class="control-icon squadron" title="Rejoin Formation"><i class="fas fa-sitemap"></i></div>`);

    button.click( (event) => {
      UserInterface._resumeFollow(selectedToken);
    });

    const column = '.col.right';
    html.find(column).append(button);
  }

  static _stopFollow(followerToken){
    warpgate.plugin.queueUpdate( async () => {
      await followerToken.unsetFlag(MODULE.data.name, MODULE['Lookout'].followPause);
      await followerToken.unsetFlag(MODULE.data.name, MODULE['Lookout'].leadersFlag);
      canvas.tokens.hud.render(false);
    });
  }

  static _resumeFollow(followerToken){

    warpgate.plugin.queueUpdate( async () => {
      await followerToken.setFlag(MODULE.data.name, MODULE['Lookout'].followPause, false);
      canvas.tokens.hud.render(false);
    });
  }

  static _targetLeader(followerToken) {

    const onTarget = async (user, token, active) => {
      if(!active || user.id !== game.user.id){
        /* we are deslecting something, keep ourselves active
         * or someone else has targeted something
         */
        Hooks.once('targetToken', onTarget);
        return;
      }

      ui.notifications.info(`${token.name} is being followed by ${followerToken.name}`);

      await Lookout.addFollower(token.id, followerToken.id, followerToken.parent.id);

      game.user.updateTokenTargets();

      /* switch back to select */
      UserInterface._activateTool(canvas.tokens, 'select');  
      token.layer.hud.clear();
      return true;
     
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
