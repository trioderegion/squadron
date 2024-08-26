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

  static _dragImg = null;

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
    Hooks.once('renderTokenHUD', this._cacheDragImg);
    Hooks.on('renderTokenHUD', this._renderTokenHUD);
    Hooks.on('dropCanvasData', this._onCanvasDrop);
  }

  static _cacheDragImg() {
    UserInterface._dragImg = new Image();
    UserInterface._dragImg.src = 'icons/svg/target.svg';
  }

  static _renderTokenHUD(app, html){
    const token = app?.object?.document;
    if (!token) return;

    const allSelected = (fn) => {
      (canvas.tokens.controlled ?? [{document: token}]).forEach( selected => fn(selected.document) );
    }

    /* which button should we show? */
    const paused = token.getFlag('%config.id%', MODULE.FLAG.paused);
    if (paused) {

      /* we are following, but have paused */
      UserInterface._addHudButton(html, token, 'sqdrn.workflow.rejoin', 'fa-sitemap', 
        ()=>{ allSelected(UserInterface.resume)});
    } else if (paused === undefined) {

      /* if the pause flag doesnt exist, we arent following anyone */
      /* special handling of multi-selected for this one, dont use helper */
      UserInterface._addHudButton(html, token, 'sqdrn.workflow.pick', 'fa-users',
        () => { 
          new Formation({
            followers: canvas.tokens.controlled.map( p => p.id ),
            scene: canvas.scene.id,
          }).render(true);
        }, true);
    } else {

      /* otherwise, we are following normally and have the option to stop */
      UserInterface._addHudButton(html, token, 'sqdrn.workflow.leave', 'fa-users-slash', 
        ()=>{ allSelected(UserInterface.stop)});
    }
  }

  static _addHudButton(html, selectedToken, title, icon, clickEvent, draggable = false) {

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
    if (draggable) {
      UserInterface._dragDrop.bind(html[0]);
      html[0].addEventListener('dragend', UserInterface._onDragEnd)
    }
  }

  static _initialTransform = 'inherit';

  static _shrinkHUD(hud) {
    if (!hud) return;
    const el = hud.element[0];
    el.style.transition = 'transform 0.5s ease-in';
    UserInterface._initialTransform = el.style.transform;
    el.style.transform += ' scale(0.5) translate(50%, 50%)';
  }

  /**
   * Restores HUD to initial styling. Half second delay to match UserInterface._shrinkHUD.
   *
   * @static
   * @param {TokenHUD} hud
   * @returns Promise<> Restore  HUD animation has completed
   * @memberof UserInterface
   */
  static _restoreHUD(hud) {
    if (!hud) return;
    hud.element[0].style.transform = UserInterface._initialTransform;

    return new Promise( resolve => (setTimeout( () => {
      hud.element[0].style.transition = 'inherit'
      resolve();
    }, 500)));
  }

  static _onDragEnd(evt) {
    UserInterface._restoreHUD(canvas.tokens.hud)
  }

  static _onDragStart(evt) {
    const dragData = {
      type: '%config.id%/target',
      selected: canvas.tokens.controlled.map( t => t.id ),
      alt: evt.altKey,
      ctrl: evt.ctrlKey,
    }
    //evt.stopPropagation();
    evt.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    const {width, height} = evt.target.getBoundingClientRect();
    const preview = DragDrop.createDragImage(UserInterface._dragImg, width, height);
    evt.dataTransfer.setDragImage(preview, width/2, height/2);
    evt.dataTransfer.effectAllowed = 'link';
    evt.dataTransfer.dropEffect = 'link';
    UserInterface._shrinkHUD(canvas.tokens.hud);
  }

  static _onCanvasDrop(canvas, {type, selected = [], x, y, alt, ctrl}) {
    if (type !== '%config.id%/target' || selected?.length == 0) return;
    
    const anim = UserInterface._restoreHUD(canvas.tokens.hud);

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
        MODULE.setTargets([targets.at(0)]);
        formation.render(true);

      } else if (ctrl) {
        anim.then( _ => {
          formation.startFollow({
            orientationVector: MODULE.CONST.SHADOW,
            snap: false,
            locks: {
              elevation: 'offset', 
              follow: true,
            }
          });
        })
      } else {
        anim.then( _ => {
          formation.startFollow({
            orientationVector: MODULE.CONST.DETECT,
            snap: true,
            locks: {
              elevation: 'tether',
              follow: false,
            }
          });
        });
      }
    }

    return false;
  }

  static async stop(followerToken) {
    await Logistics.announceStopFollow(followerToken);
    await followerToken.update({'flags.-=%config.id%': null});
    if (canvas.tokens.hud.object?.id === followerToken.id) {
      canvas.tokens.hud.render(false);
    }
  }

  static async resume(followerToken) {
    await followerToken.setFlag('%config.id%', MODULE.FLAG.paused, false);
    if (canvas.tokens.hud.object?.id === followerToken.id) {
      canvas.tokens.hud.render(false);
    }
  }
}
