import {MODULE} from '../../modules/module.mjs';

export default class extends Application {
  static get name() { return 'Formation' };
  static get template() { return `modules/%config.id%/apps/${this.name}/template.hbs` };

  static register() {
    loadTemplates([this.template]);

    MODULE.applySettings({
      creationPings: {
        scope: 'world',
        config: true,
        default: 0,
        type: Number,
        choices: {
          0: 'sqdrn.setting.creationPings.all',
          1: 'sqdrn.setting.creationPings.players',
          2: 'sqdrn.setting.creationPings.gm',
          3: 'sqdrn.setting.creationPings.none',
        },
      }
    });
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: [...super.defaultOptions.classes, '%config.id%', this.name],
      template: this.template,
      title: 'sqdrn.app.title',
      id: '%config-id%-Formation',
      top: 150,
    });
  }

  constructor({leader = null, followers = [], scene = null}, options = {}) {
    super(options);

    if (typeof followers == 'string') followers = [followers];

    if(followers.length == 0 || !scene) {
      throw new Error('Follower IDs and scene ID required');
    }

    this.squad = {leader, followers, scene};
  }

  get leader() {
    return game.scenes.get(this.squad.scene).tokens.get(this.squad.leader);
  }

  activateListeners(html) {
    super.activateListeners(html);
    this.root = html[0].parentElement;
    this.forms = this.root.querySelectorAll('form');

    this.root.addEventListener('click', this._handleClick.bind(this)) 
  }

  _handleClick(evt) {
    const button = evt.target.closest('button');
    const value = button?.dataset?.value;
    if (!value) return;

    evt.preventDefault();
    evt.stopPropagation();

    /* Even if we were assigned a leader on construction, always use
     * the current user target (if any) */
    this.squad.leader = game.user.targets.first()?.id ?? this.squad.leader;

    if (!this.squad.leader) {
      ui.notifications.info(MODULE.localize('feedback.pickTarget'));
      return;
    }
    
    const formData = {
      'elevation': 'tether',
      'snap-grid': false,
      'no-pause': false,
    };

    for (const form of this.forms) {
      const data = new FormData(form);
      Reflect.ownKeys(formData).forEach( key => {
        if (data.has(key)) formData[key] = data.get(key)
      })
    }

    const squadData = {
      orientationVector: MODULE.CONST[value],
      snap: !!formData['snap-grid'],
      locks: {
        elevation: formData['elevation'],
        follow: !!formData['no-pause']
      }
    }
    
    this.close();

    return this.startFollow(squadData);
  }

  async startFollow(squadData, silent = false) {
    if (!this.squad.leader) {
      throw new Error('Leader token required for squadron creation.');
    }

    if (squadData.orientationVector.mode === 'detect') {
      const tRot = this.leader?.rotation; 
      const tRay = Ray.fromAngle(0,0, Math.toRadians(tRot + 90), 1);
      squadData.orientationVector = {
        mode: 'vector',
        x: -tRay.B.x,
        y: tRay.B.y,
      }
    } 


    const data = [];
    for (const follower of this.squad.followers) {
      const eventData = foundry.utils.mergeObject(squadData, {
        initiator: game.user.id,
        leaderId: this.squad.leader,
        followerId: follower,
        sceneId: this.squad.scene,
      }, {overwrite: true, inplace: false});

      /* trigger all relevant events */
      await MODULE.comms.emit(MODULE.EVENT.addFollower, eventData);
      await MODULE.comms.emit(MODULE.EVENT.addLeader, eventData);

      data.push(eventData);
    }

    /* confirmation info */
    if (!silent) {
      const type = squadData.orientationVector.mode === 'vector' ? 'formation' : 'follow';

      const confirmInfo = MODULE.format(`feedback.pickConfirm.${type}`, {num: data.length})
      ui.notifications.info(confirmInfo);

      switch (MODULE.setting('creationPings')) {
        case 0:
          break;
        case 1:
          if (game.user.hasRole(CONST.USER_ROLES.PLAYER) && !game.user.isGM) break;
          return data;
        case 2:
          if (game.user.isGM) break;
          return data;
        case 3:
          return data;
      }

      const leaderObject = this.leader.object;
      const followerObjects = this.squad.followers.map( id => game.scenes.get(this.squad.scene).tokens.get(id)?.object ).filter( p => p );

      /* Chevron on leader */
      if (leaderObject) {
        const bounds = leaderObject.bounds;
        canvas.ping(bounds.center, {
          style: CONFIG.Canvas.pings.types.PULL,
          size: (bounds.width + bounds.height) / 2,
          duration: 1000,
        });
      }

      switch (type) {
        case 'formation':
          /* Chevron on leader, rotated arrows on followers */
          const rotRay = new Ray({
            x: -squadData.orientationVector.x,
            y: squadData.orientationVector.y
          },{
            x: 0, y: 0
          });
          followerObjects.forEach( p => {
            const bounds = p.bounds;
            canvas.ping(bounds.center, {
              style: CONFIG.Canvas.pings.types.ARROW,
              size: (bounds.width + bounds.height),
              rotation: rotRay.angle + Math.PI,
              duration: 1500,
            });
          });

          break;
        case 'follow':
          /* Chevron on leader, pulses on followers */
          followerObjects.forEach( p => {
            const bounds = p.bounds;
            canvas.ping(bounds.center, {
              style: CONFIG.Canvas.pings.types.PULSE,
              size: (bounds.width + bounds.height) / 2,
              rings: 4,
              duration: 1000,
            });
          });

          break;
      }

    }

    return data;
  }
}
