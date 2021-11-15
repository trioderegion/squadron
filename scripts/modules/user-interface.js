

import { MODULE } from '../module.js'
import { Lookout } from './lookout.js'
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
    const token = app?.object?.document;
    if (!token) return;

    /* which button should we show? */
    const paused = token.getFlag(MODULE.data.name, MODULE['Lookout'].followPause);
    if (paused) {

      /* we are following, but have paused */
      UserInterface._addHudButton(html, token, MODULE.localize('workflow.rejoin'), 'fa-sitemap', 
        (event)=>{ UserInterface._resumeFollow(token)});
    } else if (paused === undefined) {

      /* if the pause flag doesnt exist, we arent following anyone */
      UserInterface._addHudButton(html, token, MODULE.localize('workflow.pick'), 'fa-users',
        (event) => { UserInterface._targetLeader(token)})
    } else {

      /* otherwise, we are following normally and have the option to stop */
      UserInterface._addHudButton(html, token, MODULE.localize('workflow.leave'), 'fa-users-slash', 
        (event)=>{ UserInterface._stopFollow(token)});
    }
  }

  static _addHudButton(html, selectedToken, title, icon, clickEvent) {

    if (!selectedToken) return;

    const button = $(`<div class="control-icon squadron" title="${title}"><i class="fas ${icon}"></i></div>`);

    button.click( clickEvent );

    const column = '.col.left';
    html.find(column).append(button);
  }

  static async stop(followerToken) {
    Logistics.announceStopFollow(followerToken);
    await followerToken.unsetFlag(MODULE.data.name, MODULE['Lookout'].followPause);
    await followerToken.unsetFlag(MODULE.data.name, MODULE['Lookout'].leadersFlag);
    canvas.tokens.hud.render(false);
  }

  static async resume(followerToken) {
    await followerToken.setFlag(MODULE.data.name, MODULE['Lookout'].followPause, false);
    canvas.tokens.hud.render(false);
  }

  static _stopFollow(followerToken){
    warpgate.plugin.queueUpdate( async () => {
      await UserInterface.stop(followerToken);
    });
  }

  static _resumeFollow(followerToken){

    warpgate.plugin.queueUpdate( async () => {
      await UserInterface.resume(followerToken);
    });
  }

  /* UI Controls for switching to targeting,
   * marking the leader, and notifying
   */
  static _targetLeader(followerToken) {

    const hud = followerToken.layer.hud;

    const onTarget = async (user, token, active) => {
      if(!active || user.id !== game.user.id){
        /* we are deslecting something, keep ourselves active
         * or someone else has targeted something
         */
        Hooks.once('targetToken', onTarget);
        return;
      }

      /* confirmation info */
      const confirmInfo = MODULE.format('feedback.pickConfirm', {leaderName: token.name, followerName: followerToken.name})
      ui.notifications.info(confirmInfo);

      await Lookout.addFollower(token.id, followerToken.id, followerToken.parent.id);
      game.users.get(user.id).broadcastActivity({targets: []})
      game.user.updateTokenTargets();

      /* switch back to select */
      UserInterface._activateTool(canvas.tokens, 'select');  
      
      /* leave the hud turned off to hide the race condition?
       * that causes the hud to update on target
       */
      //hud.bind(followerToken.object);
    };

    /* register our target hook */
    Hooks.once('targetToken', onTarget);

    /* switch to targeting mode */
    UserInterface._activateTool(canvas.tokens, 'target');

    const askInfo = MODULE.format('feedback.pickAsk', {followerName: followerToken.name});
    ui.notifications.info(askInfo)

    /* suppress the token hud */
    hud.clear();
  }

  static _activateTool(layer, toolName) {
    layer.activate();
    ui.controls.control.activeTool = toolName;
    ui.controls.render();
  }


}
