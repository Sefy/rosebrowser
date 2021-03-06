var ActorObject = require('./actorobject');

/**
 * @constructor
 */
function MobObject(world) {
  ActorObject.call(this, 'mob', world);

  this.charIdx = undefined;
  this.eventIdx = undefined;
  this.stats = undefined;
  this.name = '';
  this.hp = undefined;

  this.on('damage', this._onDamage.bind(this));
}
MobObject.prototype = Object.create( ActorObject.prototype );

MobObject.prototype.setChar = function(charIdx) {
  this.charIdx = charIdx;

  var npcTable = GDM.getNow('list_npc');
  var npcRow = npcTable.row(charIdx);
  this.pawn.setScale(npcRow[4]);
  this.pawn.setModel(charIdx);

  var self = this;
  GDM.get('npc_names', function(stringTable) {
    var strKey = npcRow[40];
    var data = stringTable.getByKey(strKey);
    self.name = data.text;
    self.emit('name_changed');
  });
};

MobObject.prototype._onDamage = function(amount) {
  this.hp -= amount;
  this.emit('update_hp', this.hp, this.maxHp);
};

module.exports = MobObject;
