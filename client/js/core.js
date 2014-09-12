'use strict';

var ZZ_SCALE_IN = 0.01;
var ZZ_SCALE_OUT = 100;

/**
 * @note Returns texture immediately, but doesn't load till later.
 */
var ROSETexLoader = {};
ROSETexLoader.load = function(path, callback) {
  var tex = DDS.Loader.load(path, function() {
    if (callback) {
      callback();
    }
  });
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  return tex;
};


var cameraAnimator = null;
function CameraAnimationHandler(camera, zmoData) {
  this.time = 0;
  this.camera = camera;
  this.data = zmoData;
  this.length = this.data.frameCount / this.data.fps;
  if (this.data.channels.length != 4) {
    throw new Error('Camera ZMO has wrong number of channels');
  }
}
function interpFrame(frames, frameBase, weight) {
  var frame0 = frameBase;
  var frame1 = frameBase + 1;
  if (frame1 >= frames.length) {
    frame1 -= frames.length;
  }
  return frames[frame0].lerp(frames[frame1], weight);
}
CameraAnimationHandler.prototype.update = function(delta) {
  this.time += delta;
  if (this.time >= this.length) {
    this.time -= this.length;
  } else if (this.time < 0) {
    this.time += this.length;
  }

  var frameNum = Math.floor(this.time * this.data.fps);
  var blendWeight = this.time - (frameNum / this.data.fps);

  var eyePos = interpFrame(this.data.channels[0].frames, frameNum, blendWeight);
  var targetPos = interpFrame(this.data.channels[1].frames, frameNum, blendWeight);
  var upPos = interpFrame(this.data.channels[2].frames, frameNum, blendWeight);

  this.camera.up.set(upPos.x*ZZ_SCALE_OUT, upPos.y*ZZ_SCALE_OUT, upPos.z*ZZ_SCALE_OUT);
  this.camera.position.set(eyePos.x, eyePos.y, eyePos.z);
  this.camera.lookAt(new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z));
};


THREE.XHRLoader.prototype.crossOrigin = 'anonymous';
THREE.ImageUtils.crossOrigin = 'anonymous';




var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);

var rendererEl = document.body;
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
rendererEl.appendChild(renderer.domElement);

renderer.setClearColor( 0x888888, 1 );

var cameraBase = new THREE.Object3D();
cameraBase.position.set(5200, 5200, 0);
scene.add(cameraBase);

camera.up = new THREE.Vector3(0, 0, 1);
camera.position.x = -5;
camera.position.y = 5;
camera.position.z = 5;
camera.lookAt(new THREE.Vector3(0, 0, 0));
cameraBase.add(camera);


var guiCtl = {
  doSomething: function() {
    console.log('Yup...');
  }
};
var gui = new dat.GUI();
gui.add(guiCtl, 'doSomething');

var controls = null;

//*
controls = new THREE.OrbitControls( camera );
controls.damping = 0.2;
//*/

var axisHelper = new THREE.AxisHelper( 5 );
axisHelper.position.x = 5201;
axisHelper.position.y = 5201;
axisHelper.position.z = 40;
scene.add( axisHelper );

var axisHelper2 = new THREE.AxisHelper( 20 );
axisHelper2.position.x = 0;
axisHelper2.position.y = 0;
axisHelper2.position.z = 0;
scene.add( axisHelper2 );

/*
var animPath = '3DDATA/TITLEIROSE/CAMERA01_INSELECT01.ZMO';
ZMOLoader.load(animPath, function(zmoData) {
  cameraAnimator = new CameraAnimationHandler(camera, zmoData);
});
//*/

var defaultMat = new THREE.MeshPhongMaterial({ambient: 0x030303, color: 0xdddddd, specular: 0x009900, shininess: 30, shading: THREE.FlatShading});

var terrainTex = ROSETexLoader.load('3DDATA/TERRAIN/TILES/JUNON/JD/T021_04.DDS');
terrainTex.wrapS = THREE.RepeatWrapping;
terrainTex.wrapT = THREE.RepeatWrapping;
var terrainMat = new THREE.MeshLambertMaterial({map: terrainTex});

var worldTree = new THREE.Octree( {
  // uncomment below to see the octree (may kill the fps)
  //scene: scene,
  // when undeferred = true, objects are inserted immediately
  // instead of being deferred until next octree.update() call
  // this may decrease performance as it forces a matrix update
  undeferred: false,
  // set the max depth of tree
  depthMax: Infinity,
  // max number of objects before nodes split or merge
  objectsThreshold: 8,
  // percent between 0 and 1 that nodes will overlap each other
  // helps insert objects that lie over more than one node
  overlapPct: 0.15
} );


var directionalLight = new THREE.DirectionalLight( 0xffffff, 1.1 );
directionalLight.position.set( 100, 100, 100 );
scene.add( directionalLight );1

var hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.3 );
hemiLight.color.setHSL( 0.6, 1, 0.75 );
hemiLight.groundColor.setHSL( 0.1, 0.8, 0.7 );
hemiLight.position.z = 500;
scene.add( hemiLight );


var clock = new THREE.Clock();
var render = function () {
  requestAnimationFrame(render, rendererEl);
  var delta = clock.getDelta();
  THREE.AnimationHandler.update( delta );
  if (controls) {
    controls.update(delta);
  }

  if (moveObj) {
    /*
    var origin = moveTowards.clone();
    origin.sub(new THREE.Vector2(moveObj.position.x, moveObj.position.y));
    if (origin.lengthSq() > 0.07*0.07) {
      origin.normalize();
      origin.multiplyScalar(0.07);
    }
    moveObj.position.add(new THREE.Vector3(origin.x, origin.y, 0));
    //*/
    
    var ray = new THREE.Raycaster(new THREE.Vector3(moveObj.position.x, moveObj.position.y, 200), new THREE.Vector3(0, 0, -1));
    var octreeObjects = worldTree.search( ray.ray.origin, ray.ray.far, true, ray.ray.direction );
    var inters = ray.intersectOctreeObjects( octreeObjects );
    if (inters.length > 0) {
      var p = inters[0].point;
      moveObj.position.set(p.x, p.y, p.z);
    }
  }

  if (cameraAnimator) {
    cameraAnimator.update(delta);
  }

  renderer.render(scene, camera);

  worldTree.update();
};
render();




function makeZscMaterial(zscMat) {
  var texture = ROSETexLoader.load(zscMat.texturePath);
  //texture.anisotropy = 4;
  var material = new THREE.MeshLambertMaterial({color: 0xffffff, map: texture});
  material.skinning = zscMat.forSkinning;
  if (zscMat.twoSided) {
    material.side = THREE.DoubleSide;
  }
  if (zscMat.alphaEnabled) {
    material.transparent = true;
  }

  // TODO: temporary hack!
  if (!zscMat.forSkinning) {
    if (zscMat.alphaTestEnabled) {
      material.alphaTest = zscMat.alphaRef / 255;
    } else {
      material.alphaTest = 0;
    }
  }
  material.opacity = zscMat.alpha;
  material.depthTest = zscMat.depthTestEnabled;
  material.depthWrite = zscMat.depthWriteEnabled;
  return material;
}

function createZscObject(zscData, modelIdx) {
  var model = zscData.objects[modelIdx];

  var modelObj = new THREE.Object3D();
  modelObj.visible = false;

  var loadWarn = setTimeout(function() {
    console.log('Model took a long time to load...');
  }, 5000);

  var partMeshs = [];
  function completeLoad() {
    clearTimeout(loadWarn);
    for (var i = 0; i < partMeshs.length; ++i) {
      var part = model.parts[i];

      if (i == 0) {
        modelObj.add(partMeshs[i]);
      } else {
        partMeshs[part.parent-1].add(partMeshs[i]);
      }

    }
    modelObj.visible = true;
  }
  var loadedCount = 0;

  for (var i = 0; i < model.parts.length; ++i) {
    (function(partIdx, part) {
      var meshPath = zscData.meshes[part.meshIdx];

      var material = makeZscMaterial(zscData.materials[part.materialIdx]);

      ZMSLoader.load(meshPath, function (geometry) {
        var partMesh = new THREE.Mesh(geometry, material);
        partMesh.position.set(part.position[0], part.position[1], part.position[2]);
        partMesh.quaternion.set(part.rotation[0], part.rotation[1], part.rotation[2], part.rotation[3]);
        partMesh.scale.set(part.scale[0], part.scale[1], part.scale[2]);
        partMeshs[partIdx] = partMesh;

        if (part.animPath) {
          ZMOLoader.load(part.animPath, function(zmoData) {
            var anim = zmoData.createForStatic(part.animPath, partMeshs[partIdx]);
            anim.play();
          });
        }

        loadedCount++;
        if (loadedCount == model.parts.length) {
          completeLoad();
        }
      });
    })(i, model.parts[i]);
  }

  return modelObj;
}

var projector = new THREE.Projector();

var worldList = [];

//*
ZSCLoader.load('3DDATA/JUNON/LIST_CNST_JPT.ZSC', function(cnstData) {
  ZSCLoader.load('3DDATA/JUNON/LIST_DECO_JPT.ZSC', function (decoData) {
    for (var iy = 31; iy <= 32; ++iy) {
      for (var ix = 32; ix <= 32; ++ix) {
        (function (cx, cy) {
          var himPath = '3DDATA/MAPS/JUNON/TITLE_JPT/' + cx + '_' + cy + '.HIM';
          Heightmap.load(himPath, function (heightmap) {
            var geom = new THREE.Geometry();

            for (var vy = 0; vy < 65; ++vy) {
              for (var vx = 0; vx < 65; ++vx) {
                geom.vertices.push(new THREE.Vector3(
                    vx * 2.5, vy * 2.5, heightmap.map[(64 - vy) * 65 + (vx)] * ZZ_SCALE_IN
                ));
              }
            }

            for (var fy = 0; fy < 64; ++fy) {
              for (var fx = 0; fx < 64; ++fx) {
                var v1 = (fy + 0) * 65 + (fx + 0);
                var v2 = (fy + 0) * 65 + (fx + 1);
                var v3 = (fy + 1) * 65 + (fx + 0);
                var v4 = (fy + 1) * 65 + (fx + 1);
                var uv1 = new THREE.Vector2((fx+0)/4,(fy+0)/4);
                var uv2 = new THREE.Vector2((fx+1)/4,(fy+0)/4);
                var uv3 = new THREE.Vector2((fx+0)/4,(fy+1)/4);
                var uv4 = new THREE.Vector2((fx+1)/4,(fy+1)/4);
                geom.faces.push(new THREE.Face3(v1, v2, v3));
                geom.faces.push(new THREE.Face3(v4, v3, v2));
                geom.faceVertexUvs[0].push([uv1, uv2, uv3]);
                geom.faceVertexUvs[0].push([uv4, uv3, uv2]);
              }
            }

            geom.computeBoundingSphere();
            geom.computeBoundingBox();
            geom.computeFaceNormals();
            geom.computeVertexNormals();

            var chunkMesh = new THREE.Mesh(geom, terrainMat);
            chunkMesh.position.x = (cx - 32) * 160 - 80 + 5200;
            chunkMesh.position.y = (32 - cy) * 160 - 80 + 5200;
            scene.add(chunkMesh);

            worldTree.add(chunkMesh);
            worldList.push(chunkMesh);

            /*
            var ifoPath = '3DDATA/MAPS/JUNON/TITLE_JPT/' + cx + '_' + cy + '.IFO';
            IFOLoader.load(ifoPath, function(ifoData) {
              for (var i = 0; i < ifoData.objects.length; ++i) {
                var objData = ifoData.objects[i];
                var obj = createZscObject(decoData, objData.objectId);
                obj.position.set(5200+objData.position.x, 5200+objData.position.y, objData.position.z);
                obj.quaternion.set(objData.rotation.x, objData.rotation.y, objData.rotation.z, objData.rotation.w);
                obj.scale.set(objData.scale.x, objData.scale.y, objData.scale.z);
                scene.add(obj);
              }

              for (var i = 0; i < ifoData.buildings.length; ++i) {
                var objData = ifoData.buildings[i];
                var obj = createZscObject(cnstData, objData.objectId);
                obj.position.set(5200+objData.position.x, 5200+objData.position.y, objData.position.z);
                obj.quaternion.set(objData.rotation.x, objData.rotation.y, objData.rotation.z, objData.rotation.w);
                obj.scale.set(objData.scale.x, objData.scale.y, objData.scale.z);
                scene.add(obj);
              }
            });
            //*/
          });
        })(ix, iy);
      }
    }
  });
});

var moveObj = null;

//*/


var socket = io();
socket.emit('ping');
socket.on('pong', function (data) {
  console.log('pong');
});

//*
var charIdx = 2;
if (window.location.hash.length > 1) {
  charIdx = window.location.hash.substr(1);
}

function GroupLoader() {
  this.sources = [];
}
GroupLoader.prototype.add = function(name, loader, path) {
  this.sources.push([name, loader, path]);
};
GroupLoader.prototype.load = function(callback) {
  var self = this;
  var loadedObjs = {};
  var loadedCount = 0;
  function maybeDone() {
    if (loadedCount === self.sources.length) {
      callback(loadedObjs);
    }
  }
  for (var i = 0; i < self.sources.length; ++i) {
    (function(source) {
      var name = source[0];
      var loader = source[1];
      var path = source[2];
      loader.load(path, function(res) {
        loadedObjs[name] = res;
        loadedCount++;
        maybeDone();
      });
    })(self.sources[i]);
  }
};

var avatarGrp = new GroupLoader();
avatarGrp.add('male_skel', ZMDLoader, '3DDATA/AVATAR/MALE.ZMD');
avatarGrp.add('female_skel', ZMDLoader, '3DDATA/AVATAR/FEMALE.ZMD');
avatarGrp.add('male_face', ZSCLoader, '3DDATA/AVATAR/LIST_MFACE.ZSC');
avatarGrp.add('male_hair', ZSCLoader, '3DDATA/AVATAR/LIST_MHAIR.ZSC');
avatarGrp.add('male_body', ZSCLoader, '3DDATA/AVATAR/LIST_MBODY.ZSC');
avatarGrp.add('male_foot', ZSCLoader, '3DDATA/AVATAR/LIST_MFOOT.ZSC');
avatarGrp.add('male_arms', ZSCLoader, '3DDATA/AVATAR/LIST_MARMS.ZSC');
avatarGrp.load(function(loadedObjs) {
  var mskel = loadedObjs['male_skel'];
  var fskel = loadedObjs['female_skel'];
  var mface = loadedObjs['male_face'];
  var mhair = loadedObjs['male_hair'];
  var mbody = loadedObjs['male_body'];
  var mfoot = loadedObjs['male_foot'];
  var marms = loadedObjs['male_arms'];

  var charObj = new THREE.Object3D();
  charObj.position.set(5200, 5200, 40);
  charObj.rotation.z += Math.PI;
  charObj.scale.set(1.2,1.2,1.2);
  scene.add(charObj);
  moveObj = charObj;

  var charSkel = mskel.create(charObj);
  function addPart(zscData, modelIdx, bindBone) {
    var model = zscData.objects[modelIdx];

    for (var j = 0; j < model.parts.length; ++j) {
      (function(part) {
        var material = makeZscMaterial(zscData.materials[part.materialIdx]);

        var meshPath = zscData.meshes[part.meshIdx];
        ZMSLoader.load(meshPath, function (geometry) {
          if (bindBone === undefined) {
            var charPartMesh = new THREE.SkinnedMesh(geometry, material);
            charPartMesh.bind(charSkel);
            charObj.add(charPartMesh);
          } else {
            var charPartMesh = new THREE.Mesh(geometry, material);
            charSkel.bones[bindBone].add(charPartMesh);
          }
        });
      })(model.parts[j]);
    }
  }
  addPart(mhair, 1, 4);
  addPart(mface, 2, 4);
  addPart(mbody, 1);
  addPart(mfoot, 1);
  addPart(marms, 1);

  var animPath = '3DDATA/MOTION/AVATAR/EMPTY_RUN_M1.ZMO';
  ZMOLoader.load(animPath, function(zmoData) {
    var anim = zmoData.createForSkeleton('test', charObj, charSkel);
    anim.play();
  });

  //charObj.add(camera);
});

/*
var coreGrp = new GroupLoader();
coreGrp.add('list_npc_chr', CharacterList, '3DDATA/NPC/LIST_NPC.CHR');
coreGrp.add('part_npc_zsc', ZSCLoader, '3DDATA/NPC/PART_NPC.ZSC');
coreGrp.load(function(loadedObjs) {
  var chrData = loadedObjs['list_npc_chr'];
  var zscData = loadedObjs['part_npc_zsc'];

  var char = chrData.characters[charIdx];
  if (char == null) {
    return;d 
  }

  var charObj = new THREE.Object3D();
  charObj.position.set(5200, 5200, 40);
  charObj.scale.set(10, 10, 10);
  scene.add(charObj);
  moveObj = charObj;

  var skelPath = chrData.skeletons[char.skeletonIdx];
  ZMDLoader.load(skelPath, function(zmdData) {
    var charSkel = zmdData.create(charObj);

    var charModels = char.models;
    for (var i = 0; i < charModels.length; ++i) {
      var model = zscData.objects[charModels[i]];

      for (var j = 0; j < model.parts.length; ++j) {
        (function(part) {
          var material = makeZscMaterial(zscData.materials[part.materialIdx]);

          var meshPath = zscData.meshes[part.meshIdx];
          ZMSLoader.load(meshPath, function (geometry) {
            var charPartMesh = new THREE.SkinnedMesh(geometry, material);
            charPartMesh.bind(charSkel);
            charObj.add(charPartMesh);
          });
        })(model.parts[j]);
      }
    }

    var animPath = chrData.animations[char.animations[0]];
    ZMOLoader.load(animPath, function(zmoData) {
      var anim = zmoData.createForSkeleton('test', charObj, charSkel);
      anim.play();
    });
  });

  setTimeout(function() {
 var ray = new THREE.Raycaster(new THREE.Vector3(5200, 5200, 200), new THREE.Vector3(0, 0, -1));
 var octreeObjects = worldTree.search( ray.ray.origin, ray.ray.far, true, ray.ray.direction );
 var inters = ray.intersectOctreeObjects( octreeObjects );
 if (inters.length > 0) {
 var p = inters[0].point;
 charObj.position.set(p.x, p.y, p.z);
 }
  }, 2000);

});
//*/

var moveTowards = new THREE.Vector2(5200, 5200);

//*
rendererEl.addEventListener('mousemove', function(e) {
  e.preventDefault();

  var mouse = new THREE.Vector3(0, 0, 0.5);
  mouse.x = ( e.clientX / window.innerWidth ) * 2 - 1;
  mouse.y = - ( e.clientY / window.innerHeight ) * 2 + 1;
  projector.unprojectVector( mouse, camera );

  var cameraPos = camera.localToWorld(new THREE.Vector3(0,0,0));
  var ray = new THREE.Raycaster(cameraPos, mouse.sub( cameraPos ).normalize());
  var octreeObjects = worldTree.search( ray.ray.origin, ray.ray.far, true, ray.ray.direction );
  var inters = ray.intersectOctreeObjects( octreeObjects );

  if (inters.length > 0) {
    var p = inters[0].point;
    moveTowards.set(p.x, p.y);
    //moveObj.position.set(p.x, p.y, p.z);
  }
}, false );

//*/

/*
var rootObj = new THREE.Object3D();
scene.add(rootObj);

ZMSLoader.load('3DDATA/NPC/PLANT/JELLYBEAN1/BODY02.ZMS', function (geometry) {
  ZMSLoader.load('3DDATA/NPC/PLANT/JELLYBEAN1/BODY01.ZMS', function (geometry2) {
    ZMDLoader.load('3DDATA/NPC/PLANT/JELLYBEAN1/JELLYBEAN2_BONE.ZMD', function(zmdData) {
      ZMOLoader.load('3DDATA/MOTION/NPC/JELLYBEAN1/JELLYBEAN1_WALK.ZMO', function(zmoData) {
        var skel = zmdData.create(rootObj);

        cube = new THREE.SkinnedMesh(geometry, material1);
        cube.bind(skel);

        var cube2 = new THREE.SkinnedMesh(geometry2, material1);
        cube2.bind(skel);

        var anim = zmoData.createForSkeleton('test', rootObj, skel);
        anim.play();

        rootObj.add(cube);
        rootObj.add(cube2);


      });
    });
  });
});
//*/
