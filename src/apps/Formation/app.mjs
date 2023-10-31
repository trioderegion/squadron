export default class extends FormApplication {
  static get name() { return 'Formation' };
  static get template() { return `modules/%config.id%/apps/${this.name}/template.hbs` };

  static register() {
    console.log('formation app loaded');
    loadTemplates([this.template]);
    Hooks.on('ready', () => new this({}).render(true))
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: [...super.defaultOptions.classes, '%config.id%', this.name],
      template: this.template,
    });
  }
}
