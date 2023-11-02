export default class extends Application {
  static get name() { return 'Formation' };
  static get template() { return `modules/%config.id%/apps/${this.name}/template.hbs` };

  static register() {
    console.log('formation app loaded');
    loadTemplates([this.template]);
    Hooks.on('ready', () => new this({leader:'a', follower:'b', scene:'c'}).render(true))
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: [...super.defaultOptions.classes, '%config.id%', this.name],
      template: this.template,
      title: 'Squadron Token Configuration',
      top: 100,
      simulate:true,
    });
  }

  constructor({leader = null, follower = null, scene = null}, options = {}) {
    super(options);
    if(!leader || !follower || !scene) {
      throw new Error('leader, follower, and scene IDs required');
    }

    this.squad = {leader, follower, scene};
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
      'elevation': 'tethered',
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
      initiator: game.user.id,
      orientationVector: squadron.CONST[value],
      leaderId: this.squad.leader,
      followerId: this.squad.follower,
      sceneId: this.squad.scene,
      snap: !!formData['snap-grid'],
      locks: {
        planar: squadron.CONST[value].mode == 'static',
        elevation: formData['elevation'] == 'offset',
        follow: !!formData['no-pause']
      }
    }
    
    if (this.options.simulate) {
      console.debug(squadron.EVENTS.addFollowerEvent, MODULE[NAME].addLeaderEvent, squadData);
    } else {
      /* trigger all relevant events */
      warpgate.event.notify(squadron.EVENTS.addFollowerEvent, squadData);
      warpgate.event.notify(squadron.EVENTS.addLeaderEvent, squadData);
    }

    return eventData
  }
}
