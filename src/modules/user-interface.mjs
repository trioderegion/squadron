import { MODULE } from './module.mjs'
import { Logistics } from './logistics.mjs'
import Formation from '../apps/Formation';

export class UserInterface {

  static register() {
    this.settings();
    this.hooks();
  }

  static settings() {
    const config = true;
    const settingsData = {
      silentCollide: {
        scope: "client", config, default: false, type: Boolean
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
    const paused = token.getFlag('%config.id%', MODULE.FLAG.paused);
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
        ()=>{ allSelected(UserInterface.stop)});
    }
  }

  static _addHudButton(html, selectedToken, title, icon, clickEvent) {

    if (!selectedToken) return;

    const button = $(`<div class="control-icon squadron" title="${title}"><i class="fas ${icon}"></i></div>`);

    button.on('mouseup', clickEvent );

    const column = '.col.left';
    html.find(column).append(button);
  }

  static async stop(followerToken) {
    await Logistics.announceStopFollow(followerToken);
    await followerToken.update({'flags.-=%config.id%': null});
    if (canvas.tokens.hud.object) canvas.tokens.hud.render(false);
  }

  static async resume(followerToken) {
    await followerToken.setFlag('%config.id%', MODULE.FLAG.paused, false);
    if (canvas.tokens.hud.object) canvas.tokens.hud.render(false);
  }

  /**
   * @returns {Promise}
   */
  static _resumeFollow(followerToken){
    return UserInterface.resume(followerToken);
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

      UserInterface._queryOrientationAndFollow(token.document, followerToken, true); 

      /* remove targets */
      game.users.get(user.id).broadcastActivity({targets: []})
      game.user.updateTokenTargets();

    }

    /* register our target hook */
    Hooks.once('targetToken', onTarget);
  }

  static _queryOrientationAndFollow(leaderToken, followerToken, allSelected = true) {

    const followerGroup = allSelected ? canvas.tokens.controlled : [followerToken];

    new Formation({leader:leaderToken.id, followers: followerGroup.map( t => t.id ), scene: leaderToken.parent.id}).render(true);
    
  }

  /* UI Controls for switching to targeting,
   * marking the leader, and notifying
   */
  static _targetLeader(followerToken) {

    /* suppress the token hud */
    const hud = followerToken.layer.hud;
    hud.clear();

    ui.notifications.info(MODULE.format('feedback.pickTarget', {followerName: followerToken.name}));
    return UserInterface._toolTarget(followerToken);
  }

}
