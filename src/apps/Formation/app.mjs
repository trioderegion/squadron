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

    if(!leader || followers.length == 0 || !scene) {
      throw new Error('leader, follower(s), and scene IDs required');
    }

    this.squad = {leader, followers, scene};
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
    const confirmInfo = MODULE.format('feedback.pickConfirm', {num: data.length})
    ui.notifications.info(confirmInfo);

    return data;
  }
}
