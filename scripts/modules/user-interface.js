

import { MODULE } from '../module.js'
import { Lookout } from './lookout.js'
import { Logistics } from './logistics.js'
import { logger } from './logger.js'

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

    const allSelected = (fn) => {
      (canvas.tokens.controlled ?? [{document: token}]).forEach( selected => fn(selected.document) );
    }

    /* which button should we show? */
    const paused = token.getFlag(MODULE.data.name, MODULE['Lookout'].followPause);
    if (paused) {

      /* we are following, but have paused */
      UserInterface._addHudButton(html, token, MODULE.localize('workflow.rejoin'), 'fa-sitemap', 
        (event)=>{ allSelected(UserInterface._resumeFollow)});
    } else if (paused === undefined) {

      /* if the pause flag doesnt exist, we arent following anyone */
      /* special handling of multi-selected for this one, dont use helper */
      UserInterface._addHudButton(html, token, MODULE.localize('workflow.pick'), 'fa-users',
        (event) => { UserInterface._targetLeader(token)})
    } else {

      /* otherwise, we are following normally and have the option to stop */
      UserInterface._addHudButton(html, token, MODULE.localize('workflow.leave'), 'fa-users-slash', 
        (event)=>{ allSelected(UserInterface._stopFollow)});
    }
  }

  /* eventData: {tokenId, tokenName, user} */
  static notifyCollision(eventData) {
    logger.notify(MODULE.format('feedback.wallCollision', {tokenId: eventData.tokenId, tokenName: eventData.tokenName}));
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
    await followerToken.update({'flags.-=squadron': null});
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

      let eventData = {
        orientationVector: squadron.CONST.QUERY
      };

      for (const selected of canvas.tokens.controlled) {
        if (!eventData) break;
        eventData = await Lookout.addFollower(token.id, selected.id, followerToken.parent.id,
          eventData.orientationVector, eventData.locks )
      }

      /* remove targets */
      game.users.get(user.id).broadcastActivity({targets: []})
      game.user.updateTokenTargets();

      /* switch back to select */
      UserInterface._activateTool(canvas.tokens, 'select');  
      
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
