import './user-interface.scss';

import { MODULE } from './module.mjs';
import { Logistics } from './logistics.mjs';
import Formation from '../apps/Formation';

export class UserInterface {

  static _dragDrop = new DragDrop({
    dragSelector: '.control-icon.%config.id%', 
    callbacks: {
      dragstart: this._onDragStart,
    },
  });

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
    Hooks.on('renderTokenHUD', this._renderTokenHUD);
    Hooks.on('dropCanvasData', this._onCanvasDrop);
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
        () => { UserInterface._targetLeader(token)});
      UserInterface._dragDrop.bind(html[0]);
    } else {

      /* otherwise, we are following normally and have the option to stop */
      UserInterface._addHudButton(html, token, MODULE.localize('workflow.leave'), 'fa-users-slash', 
        ()=>{ allSelected(UserInterface.stop)});
    }
  }

  static _addHudButton(html, selectedToken, title, icon, clickEvent) {

    if (!selectedToken) return;
    
    const button = new DocumentFragment();
    button.append(document.createElement('div'))
    button.firstElementChild.classList.add('control-icon', '%config.id%');
    button.firstElementChild.dataset.tooltip = title;

    const iconElement = document.createElement('i');
    iconElement.classList.add('fas', icon);
    button.firstElementChild.append(iconElement);

    button.firstElementChild.addEventListener('click', clickEvent);
    html[0].querySelector('.col.left').append(button);
  }

  static _shrinkHUD(hud) {
    if (!hud) return;
    hud.element[0].style.transition = 'scale 0.5s';
    hud.element[0].style.transformOrigin = 'center';
    hud.element[0].style.scale = 0.5;
  }

  static _restoreHUD(hud) {
    if (!hud) return;
    hud.element[0].style.transformOrigin = 'inherit';
    hud.element[0].style.scale = 'inherit';
    hud.element[0].style.transition = 'inherit';
  }

  static _onDragStart(evt) {
    const dragData = {
      type: '%config.id%/target',
      selected: canvas.tokens.controlled.map( t => t.id ),
      alt: evt.altKey,
      ctrl: evt.ctrlKey,
    }
    evt.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    UserInterface._shrinkHUD(canvas.tokens.hud);
  }

  static _onCanvasDrop(canvas, {type, selected = [], x, y, alt, ctrl}) {
    if (type !== '%config.id%/target' || selected?.length == 0) return;

    UserInterface._restoreHUD(canvas.tokens.hud);

    /* create 20x20 target area to find placeables */
    let targets = [];
    const hitArea = new PIXI.Rectangle(x - 10, y - 10, 20, 20)
    for (const token of canvas.tokens.placeables.filter(t => t.isVisible && !selected.includes(t.id))) {
      if (token._overlapsSelection(hitArea)) targets.push(token);
    }
    targets.sort( (left, right) => left.document.sort > right.document.sort ? -1 : left.document.sort < right.document.sort ? 1 : 0);
    
    if (targets.length > 0) {
      const formation = new Formation({
        leader: targets.at(0).id,
        followers: selected,
        scene: canvas.scene.id
      });

      if (alt) {
        formation.render(true);
      } else if (ctrl) {
        formation.startFollow({
          orientationVector: MODULE.CONST.SHADOW,
          snap: false,
          locks: {
            elevation: 'offset', 
            follow: true,
          }
        });
      } else {
          formation.startFollow({
            orientationVector: MODULE.CONST.DETECT,
            snap: true,
            locks: {
              elevation: 'tether',
              follow: false,
            }
          });
      }
    }

    return false;
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

  static _hookID = null;

  static _toolTarget(followerToken) {

    const hud = followerToken.layer.hud;

    /* use targeting tool */
    const onTarget = async (user, token, active) => {

      /* we are deslecting something, keep ourselves active
       * or someone else has targeted something
       */
      if(!active || user.id !== game.user.id){
        return;
      }

      Hooks.off('targetToken', onTarget);
      UserInterface._hookID = null;
      UserInterface._restoreHUD(hud);
      UserInterface._queryOrientationAndFollow(token.document, followerToken, true); 

      /* remove targets */
      game.users.get(user.id).broadcastActivity({targets: []})
      game.user.updateTokenTargets();

    }

    /* suppress the token hud */
    UserInterface._shrinkHUD(hud)

    /* register our target hook */
    if (!UserInterface._hookID) UserInterface._hookID = Hooks.on('targetToken', onTarget);
  }

  static _queryOrientationAndFollow(leaderToken, followerToken, allSelected = true) {

    const followerGroup = allSelected ? canvas.tokens.controlled : [followerToken];

    new Formation({leader:leaderToken.id, followers: followerGroup.map( t => t.id ), scene: leaderToken.parent.id}).render(true);
    
  }

  /* UI Controls for switching to targeting,
   * marking the leader, and notifying
   */
  static _targetLeader(followerToken) {

    ui.notifications.info(MODULE.format('feedback.pickTarget', {followerName: followerToken.name}));
    return UserInterface._toolTarget(followerToken);
  }

}
