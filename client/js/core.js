'use strict';

// Set some default values
THREE.XHRLoader.prototype.crossOrigin = 'anonymous';
THREE.ImageUtils.crossOrigin = 'anonymous';


// Set up the renderer
var renderer = null;
renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.setClearColor( 0x888888, 1 );
renderer.autoClear = false;

// Load any needed extensions
var minMaxGlExt = renderer.getContext().getExtension('EXT_blend_minmax');
if (!minMaxGlExt) {
  console.warn('Could not load blend_minmax extension!');
}


// Create a global scene to work with
var scene = new THREE.Scene();
var skyScene = new THREE.Scene();
var skyObject = null;

// Set up some basic initial lighting
var directionalLight = new THREE.DirectionalLight( 0xffffff, 1.1 );
directionalLight.position.set( 100, 100, 100 );
scene.add( directionalLight );

var hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.3 );
hemiLight.color.setHSL( 0.6, 1, 0.75 );
hemiLight.groundColor.setHSL( 0.1, 0.8, 0.7 );
hemiLight.position.z = 500;
scene.add( hemiLight );


// Set a global camera to work with
var camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.up.copy(new THREE.Vector3(0, 0, 1));
camera.position.copy(new THREE.Vector3(-15, 15, 15));
camera.lookAt(new THREE.Vector3(0, 0, 0));

camera.position.add(new THREE.Vector3(5200, 5200, 0));

// Auto resize canvas
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}

// Default material for testing with
var defaultMat = new THREE.MeshPhongMaterial({ambient: 0x030303, color: 0xdddddd, specular: 0x009900, shininess: 30, shading: THREE.FlatShading});


// Create a debug GUI manager.
var debugGui = new dat.GUI();
DebugHelper.init();

// Set up the debugging camera
var debugCamera = null;
var debugInput = new EventEmitter();
var debugControls = null;
var debugCamFrust = new THREE.CameraHelper(camera);

function initDebugCamera() {
  debugCamera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
  debugCamera.position.setFromMatrixPosition(camera.matrixWorld);
  debugCamera.quaternion.setFromRotationMatrix(camera.matrixWorld);
  debugControls = new THREE.FreeFlyControls(debugCamera, debugInput);
  debugControls.movementSpeed = 100;
  debugCamFrust.camera = camera;
  scene.add(debugCamFrust);
}

function destroyDebugCamera() {
  debugCamera = null;
  debugControls = null;
  scene.remove(debugCamFrust);
}

var debugTriggerKeyCodes = [ 192, 223 ];
var inputMgrEventHandler = InputManager._handleEvent;
InputManager._handleEvent = function(name, e) {
  if (name === 'keydown' && debugTriggerKeyCodes.indexOf(e.keyCode) !== -1) {
    if (!debugCamera) {
      initDebugCamera();
    } else {
      destroyDebugCamera();
    }
    e.preventDefault();
    return;
  }

  if (debugControls) {
    debugInput.emit(name, e);
  } else {
    // Use the default handler
    inputMgrEventHandler.call(this, name, e);
  }
};

var activeGameState = null;

// FPS / MS indicator
var stats = new Stats();
stats.setMode(1); // 0: FPS, 1: MS
stats.domElement.style.position = 'absolute';
stats.domElement.style.left = '0px';
stats.domElement.style.top = '0px';
document.body.appendChild( stats.domElement );

var clock = new THREE.Clock();
var renderFrame = function () {
  requestAnimationFrame(renderFrame, renderer.domElement);
  stats.begin();

  var delta = clock.getDelta();
  THREE.AnimationHandler.update( delta );

  if (activeGameState) {
    activeGameState.update(delta);
  }

  var renderCamera = camera;
  if (debugCamera) {
    debugCamFrust.update(delta);
    debugControls.update(delta);
    renderCamera = debugCamera;
  }

  // TODO: I don't think this works how I think it works.
  //  Everything appears to draw perfectly correctly no matter what
  //  clearing flags I set, or what clearing I do on my own...
  if (skyObject) {
    skyObject.position.copy(renderCamera.position);
    renderer.render(skyScene, renderCamera);
    renderer.clear(false, true, false);
  } else {
    renderer.clear(true, true, false);
  }
  renderer.render(scene, renderCamera);

  stats.end();
};
renderFrame();

var launchStateName = clientParams.length > 0 ? clientParams[0] : 'test';
console.log('Launching game with state `' + launchStateName + '`');

var launchGameState = null;
if (launchStateName === 'test') {
  launchGameState = gsTest;
} else if (launchStateName === 'nettest') {
  launchGameState = gsNetTest;
} else if (launchStateName === 'login') {
  launchGameState = gsLogin;
} else if (launchStateName === 'gametest') {
  launchGameState = gsGameTest;
} else if (launchStateName === 'particle') {
  launchGameState = gsParticleTest;
} else {
  console.log('Invalid launch state specified.');
}

if (clientParams.indexOf('lmonly') !== -1) {
  config.lmonly = true;
}

ShaderManager.register('skydome', 'skydome.vert', 'skydome.frag', {
  depthWrite: false,
  depthTest: false
});
ShaderManager.register('terrain', 'terrain.vert', 'terrain.frag', {
  attributes: {uv3:{}}
});
ShaderManager.register('terrain_lmonly', 'terrain.vert', 'terrain_lmonly.frag', {
  attributes: {uv3:{}}
});
ShaderManager.register('staticobj', 'staticobj.vert', 'staticobj.frag');
ShaderManager.register('staticobj_lmonly', 'staticobj.vert', 'staticobj_lmonly.frag');
ShaderManager.register('water', 'water.vert', 'water.frag');
ShaderManager.register('particle', 'particle.vert', 'particle.frag', {
  attributes: {
    alpha: { type: 'f', value: [] },
    psize: { type: 'f', value: [] }
  }
});

if (launchGameState) {
  // Shaders before anything else
  ShaderManager.init(function() {
    // Needed for game states that alter UI.
    $(function() {
      launchGameState.prepare(function() {
        launchGameState.enter();
        activeGameState = launchGameState;
      });
    });
  });
}

function Conversation(spec, lang) {
  this.state = new ConversationState(spec, lang);
  this.luaState = eval(lua_load(spec.luaData))();
  QF_Init(this.luaState);
}

Conversation.prototype.exec = function() {
  while (true) {
    var reqval = this.state.exec();
    if (reqval === CXECURREQ.LUACONDITION) {
      var luaRes = lua_tablegetcall(this.luaState, this.state.condParam)[0];
      this.state.condValue = luaRes;
    } else if (reqval === CXECURREQ.OPTCONDITION) {
      console.log('WANTS OPTIONS', this.state);
      break;
    } else if (reqval === CXECURREQ.CLOSE) {
      console.log('WANTS TO CLOSE', this.state);
      break;
    } else {
      console.log('WANTS SOMETHING UNKNOWN', this.state);
      break;
    }
  }
};

/*
ConversationSpec.load('3DDATA/EVENT/EM02-030.cxe', function(convSpec) {
  var conv = new Conversation(convSpec, 'en');
  conv.exec();
});
*/


GDM.register('list_event', DataTable, '3DDATA/STB/LIST_EVENT.STB');
GDM.register('quest_scripts', QuestScriptManager, '3DDATA/STB/LIST_QUESTDATA.STB');

GDM.register('list_zone', DataTable, '3DDATA/STB/LIST_ZONE.STB');
GDM.register('zone_names', StringTable, '3DDATA/STB/LIST_ZONE_S.STL');

GDM.register('char_motiontypes', DataTable, '3DDATA/STB/TYPE_MOTION.STB');
GDM.register('char_motions', DataTable, '3DDATA/STB/FILE_MOTION.STB');

GDM.register('npc_chars', CharacterList, '3DDATA/NPC/LIST_NPC.CHR');
GDM.register('npc_models', ModelListManager, '3DDATA/NPC/PART_NPC.ZSC');

GDM.register('male_skel', Skeleton, '3DDATA/AVATAR/MALE.ZMD');
GDM.register('female_skel', Skeleton, '3DDATA/AVATAR/FEMALE.ZMD');

GDM.register('itm_mface', ModelListManager, '3DDATA/AVATAR/LIST_MFACE.ZSC');
GDM.register('itm_mhair', ModelListManager, '3DDATA/AVATAR/LIST_MHAIR.ZSC');
GDM.register('itm_mcap', ModelListManager, '3DDATA/AVATAR/LIST_MCAP.ZSC');
GDM.register('itm_mbody', ModelListManager, '3DDATA/AVATAR/LIST_MBODY.ZSC');
GDM.register('itm_marms', ModelListManager, '3DDATA/AVATAR/LIST_MARMS.ZSC');
GDM.register('itm_mfoot', ModelListManager, '3DDATA/AVATAR/LIST_MFOOT.ZSC');

GDM.register('itm_fface', ModelListManager, '3DDATA/AVATAR/LIST_WFACE.ZSC');
GDM.register('itm_fhair', ModelListManager, '3DDATA/AVATAR/LIST_WHAIR.ZSC');
GDM.register('itm_fcap', ModelListManager, '3DDATA/AVATAR/LIST_WCAP.ZSC');
GDM.register('itm_fbody', ModelListManager, '3DDATA/AVATAR/LIST_WBODY.ZSC');
GDM.register('itm_farms', ModelListManager, '3DDATA/AVATAR/LIST_WARMS.ZSC');
GDM.register('itm_ffoot', ModelListManager, '3DDATA/AVATAR/LIST_WFOOT.ZSC');

if (config.isEvoData) {
  GDM.register('itm_mfaceitem', ModelListManager, '3DDATA/AVATAR/LIST_MFACEITEM.ZSC');
  GDM.register('itm_ffaceitem', ModelListManager, '3DDATA/AVATAR/LIST_WFACEITEM.ZSC');
} else {
  GDM.register('itm_mfaceitem', ModelListManager, '3DDATA/AVATAR/LIST_FACEITEM.ZSC');
  GDM.register('itm_ffaceitem', ModelListManager, '3DDATA/AVATAR/LIST_FACEITEM.ZSC');
}

GDM.register('itm_back', ModelListManager, '3DDATA/AVATAR/LIST_BACK.ZSC');
GDM.register('itm_weapon', ModelListManager, '3DDATA/WEAPON/LIST_WEAPON.ZSC');
GDM.register('itm_subwpn', ModelListManager, '3DDATA/WEAPON/LIST_SUBWPN.ZSC');

GDM.get('quest_scripts', function(questScripts) {
  console.log('Quest Scripts Loaded');
  console.log(questScripts);
});


