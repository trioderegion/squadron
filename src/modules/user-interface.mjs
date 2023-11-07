import { MODULE } from './module.mjs'
import { Logistics } from './logistics.mjs'
import { logger } from './logger.mjs'
import Formation from '../apps/Formation';

export class UserInterface {

  static register() {
    this.settings();
    this.hooks();
  }

  static settings() {
    const config = true;
    const settingsData = {
      useCrosshairs: {
        scope: "world", config, default: true, type: Boolean
      }
    }

    MODULE.applySettings(settingsData);
  }

  static hooks(){
    Hooks.on('renderTokenHUD', UserInterface._renderTokenHUD);
  }

  static _renderTokenHUD(app, html/*, data*/){
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
        ()=>{ allSelected(UserInterface._resumeFollow)});
    } else if (paused === undefined) {

      /* if the pause flag doesnt exist, we arent following anyone */
      /* special handling of multi-selected for this one, dont use helper */
      UserInterface._addHudButton(html, token, MODULE.localize('workflow.pick'), 'fa-users',
        () => { UserInterface._targetLeader(token)})
    } else {

      /* otherwise, we are following normally and have the option to stop */
      UserInterface._addHudButton(html, token, MODULE.localize('workflow.leave'), 'fa-users-slash', 
        ()=>{ allSelected(UserInterface._stopFollow)});
    }
  }

  /* eventData: {tokenId, tokenName, user} */
  static notifyCollision(eventData) {
    logger.notify(MODULE.format('feedback.wallCollision', {tokenId: eventData.tokenId, tokenName: eventData.tokenName}));
  }

  static _addHudButton(html, selectedToken, title, icon, clickEvent) {

    if (!selectedToken) return;

    const button = $(`<div class="control-icon squadron" title="${title}"><i class="fas ${icon}"></i></div>`);

    button.on('mouseup', clickEvent );

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

  static _toolTarget(followerToken) {
    /* use targeting tool */
    const onTarget = async (user, token, active) => {
      if(!active || user.id !== game.user.id){
        /* we are deslecting something, keep ourselves active
         * or someone else has targeted something
         */
        Hooks.once('targetToken', onTarget);
        return;
      }

      const eventData = await UserInterface._queryOrientationAndFollow(token, followerToken, true); 

      /* remove targets */
      game.users.get(user.id).broadcastActivity({targets: []})
      game.user.updateTokenTargets();

      /* switch back to select */
      UserInterface._activateTool(canvas.tokens, 'select');  

      return eventData;
    }

    /* register our target hook */
    Hooks.once('targetToken', onTarget);

    /* switch to targeting mode */
    UserInterface._activateTool(canvas.tokens, 'target');

  }

  static async _crosshairsTarget(followerToken){

    let targetToken = null;
    while (!targetToken) {
      const result = await warpgate.crosshairs.show({
        drawIcon: false,
        interval: 0,
        lockSize: false,
        size: 1.5,
        rememberControlled: true,
        fillColor: "#FF0000",
        fillAlpha: 0.3
      });

      if ( result.cancelled ) return;

      /* if we have some selected create a list of IDs to filter OUT of the collected tokens.
       * We refuse to have a token follow itself
       */
      const selectedIds = canvas.tokens.controlled.map( t => t.id );

      const tokens = warpgate.crosshairs.collect(result).filter( token => !selectedIds.includes(token.id) );

      tokens.sort( (a, b,) => {
        /* compute distance */
        const distanceA = new Ray(followerToken.object.center, a.object.center).distance;
        const distanceB = new Ray(followerToken.object.center, b.object.center).distance;

        return distanceA < distanceB ? -1 : distanceA > distanceB ? 1 : 0;
      });

      targetToken = tokens[0];
    }

    return targetToken;

  }

  static async _queryOrientationAndFollow(leaderToken, followerToken, allSelected = true) {

    const followerGroup = allSelected ? canvas.tokens.controlled : [followerToken];

    new Formation({leader:leaderToken.id, followers: followerGroup.map( t => t.id ), scene: leaderToken.parent.id}).render(true);
    
  }

  /* UI Controls for switching to targeting,
   * marking the leader, and notifying
   */
  static async _targetLeader(followerToken) {

    const hud = followerToken.layer.hud;

    const useCrosshairs = MODULE.setting('useCrosshairs');

    const askInfo = MODULE.format('feedback.pickAsk', {followerName: followerToken.name});
    ui.notifications.info(askInfo)

    /* suppress the token hud */
    hud.clear();

    if (useCrosshairs) {
      
      const targetToken = await UserInterface._crosshairsTarget(followerToken);

      if (!targetToken) return;
      
      return UserInterface._queryOrientationAndFollow(targetToken, followerToken, true);

    } else {
      return UserInterface._toolTarget(followerToken);
    }
  }

  static _activateTool(layer, toolName) {
    layer.activate();
    ui.controls.control.activeTool = toolName;
    ui.controls.render();
  }


}
