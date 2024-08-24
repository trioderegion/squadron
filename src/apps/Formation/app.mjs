import {MODULE} from '../../modules/module.mjs';

export default class extends Application {
  static get name() { return 'Formation' };
  static get template() { return `modules/%config.id%/apps/${this.name}/template.hbs` };

  static register() {
    loadTemplates([this.template]);
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: [...super.defaultOptions.classes, '%config.id%', this.name],
      template: this.template,
      title: MODULE.format('app.title'),
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
    this.squad.leader ??= game.user.targets.first()?.id;

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

  async startFollow(squadData) {
    if (!this.squad.leader) {
      throw new Error('Leader token required for squadron creation.');
    }

    if (squadData.orientationVector.mode === 'detect') {
      const tRot = this.leader?.rotation; 
      const tRay = Ray.fromAngle(0,0, Math.toRadians(tRot + 90), 1);
      squadData.orientationVector = {
        mode: 'vector',
        x: Math.abs(tRay.dx < 1e-10) ? 0 : -tRay.B.x,
        y: Math.abs(tRay.dy < 1e-10) ? 0 : tRay.B.y,
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
    const type = squadData.orientationVector.mode === 'vector' ? 'formation' : 'follow';
    const confirmInfo = MODULE.format(`feedback.pickConfirm.${type}`, {num: data.length})
    ui.notifications.info(confirmInfo);

    return data;
  }
}
