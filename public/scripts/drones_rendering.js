import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const state = {
  // data loaded from JSON
  framerate: null,
  dronesData: null,
  drones: null,
  scaleFactor: 0.01,

  // three.js core
  scene: null,
  camera: null,
  renderer: null,
  controls: null,

  // models & runtime
  droneModels: [], // { model: THREE.Object3D, waypoints: [...], previousPosition: THREE.Vector3|null }
  collisions: [],
  speedWarnings: [],

  // playback
  isPlaying: false,
  currentTime: 0,
  maxTime: 0,

  // constants
  collisionRadius: 1,
  maxSpeed: 5,

  // helpers
  loader: null,
  clock: null
};


/** format seconds to M:SS (simple) */
const formatTime = (time) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

/** safe DOM getter */
const $ = (id) => document.getElementById(id);


/** load JSON with waypoints and set up basic timing values */
const loadData = async (url = '/data/waypoints3.json') => {
  const dronesData = await fetch(url).then(res => res.json());
  state.dronesData = dronesData;
  state.framerate = dronesData.framerate;
  state.drones = dronesData.drones;
  // compute maxTime from first drone last waypoint (same logic as original)
  state.maxTime = state.drones[0].waypoints[state.drones[0].waypoints.length - 1].frame / state.framerate;
};

/** create scene, camera, renderer and append renderer DOM */
const createRendererAndCamera = () => {
  state.scene = new THREE.Scene();

  state.camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
  );
  state.camera.position.set(0, 3, 5);

  state.renderer = new THREE.WebGLRenderer({ antialias: true });
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(state.renderer.domElement);

  // Keep clock for animation timing
  state.clock = new THREE.Clock();
};

/** handle window resize (keeps logic identical) */
const setupResizeHandler = () => {
  window.addEventListener('resize', () => {
    state.camera.aspect = window.innerWidth / window.innerHeight;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(window.innerWidth, window.innerHeight);
  });
};

/** add orbit controls and lights to the scene */
const addControlsAndLights = () => {
  state.controls = new OrbitControls(state.camera, state.renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  state.scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0xffffff, 0.8);
  pointLight.position.set(10, 10, 10);
  state.scene.add(pointLight);
};

/** create ground plane with repeating texture */
const addGround = () => {
    const groundTexture = new THREE.TextureLoader().load('models/sol.jpg');
  
    // Repetition of the texture
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(200, 200);
  
    groundTexture.minFilter = THREE.NearestFilter;
    groundTexture.magFilter = THREE.NearestFilter;
    groundTexture.anisotropy = state.renderer.capabilities.getMaxAnisotropy();
  
    const groundMaterial = new THREE.MeshPhongMaterial({ map: groundTexture });
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
  
    state.scene.add(ground);
  };
  

/** add a simple skybox (single texture on a giant cube) */
const addSkybox = () => {
  const skyboxTexture = new THREE.TextureLoader().load('models/ciel.jpg');
  const skyboxGeometry = new THREE.BoxGeometry(5000, 5000, 5000);
  const skyboxMaterial = new THREE.MeshBasicMaterial({
    map: skyboxTexture,
    side: THREE.BackSide
  });
  const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
  state.scene.add(skybox);
};

/** load drone OBJ and instantiate a clone per drone record */
const loadDroneModelAndInstantiate = () => {
  state.loader = new OBJLoader();

  // loader callback clones the loaded object for each drone in data
  state.loader.load('models/drone.obj', (object) => {
    object.scale.set(0.5, 0.5, 0.5);

    // instantiate clones for each drone, set initial position, and push to state.droneModels
    state.drones.forEach((droneData) => {
      const drone = object.clone();
      const initialPosition = droneData.waypoints[0].position;
      drone.position.set(
        initialPosition.lng_X * state.scaleFactor,
        initialPosition.alt_Y * state.scaleFactor,
        initialPosition.lat_Z * state.scaleFactor
      );
      state.scene.add(drone);
      state.droneModels.push({
        model: drone,
        waypoints: droneData.waypoints,
        previousPosition: null
      });
    });
  });
};

/** draw green trajectory lines for every drone (points from waypoints) */
const drawTrajectories = () => {
  state.drones.forEach((droneData) => {
    const waypoints = droneData.waypoints.map(wp => {
      const pos = wp.position;
      return new THREE.Vector3(
        pos.lng_X * state.scaleFactor,
        pos.alt_Y * state.scaleFactor,
        pos.lat_Z * state.scaleFactor
      );
    });

    const geometry = new THREE.BufferGeometry().setFromPoints(waypoints);
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    const line = new THREE.Line(geometry, material);
    state.scene.add(line);
  });
};


/**
 * updateDrones(time)
 * - move every drone by linear interpolation between surrounding frames
 * - detect speed warnings and collisions (same threshold logic)
 * - update UI lists (collisions, speed warnings)
 */
const updateDrones = (time) => {
  const framerate = state.framerate;
  const scaleFactor = state.scaleFactor;

  state.droneModels.forEach((drone, index) => {
    const waypoints = drone.waypoints;
    const currentFrame = Math.floor(time * framerate);
    const nextFrame = waypoints.findIndex(wp => wp.frame > currentFrame);

    if (nextFrame > 0) {
      const currentPos = waypoints[nextFrame - 1].position;
      const nextPos = waypoints[nextFrame].position;

      const t = (time * framerate - waypoints[nextFrame - 1].frame) /
                (waypoints[nextFrame].frame - waypoints[nextFrame - 1].frame);

      const interpolatedPos = {
        x: THREE.MathUtils.lerp(currentPos.lng_X, nextPos.lng_X, t) * scaleFactor,
        y: THREE.MathUtils.lerp(currentPos.alt_Y, nextPos.alt_Y, t) * scaleFactor,
        z: THREE.MathUtils.lerp(currentPos.lat_Z, nextPos.lat_Z, t) * scaleFactor,
      };

      drone.model.position.set(interpolatedPos.x, interpolatedPos.y, interpolatedPos.z);

      if (drone.previousPosition) {
        const distance = drone.model.position.distanceTo(drone.previousPosition);
        const speed = distance / (1 / framerate); // meters per second, same as original
        if (speed > state.maxSpeed) {
          state.speedWarnings.push({ droneId: index, time: state.currentTime, speed: speed });
        }
      }

      drone.previousPosition = drone.model.position.clone();
    }
  });

  // collision detection between every pair of drones (same logic threshold)
  for (let i = 0; i < state.droneModels.length; i++) {
    for (let j = i + 1; j < state.droneModels.length; j++) {
      const distance = state.droneModels[i].model.position.distanceTo(state.droneModels[j].model.position);
      if (distance < state.collisionRadius * 2) {
        state.collisions.push({ drone1: i, drone2: j, time: state.currentTime });
      }
    }
  }

  updateCollisionsList();
  updateSpeedWarningsList();
};


const updateCollisionsList = () => {
  const collisionsList = $('collisions');
  if (!collisionsList) return;
  collisionsList.innerHTML = state.collisions
    .map(c => `Drone ${c.drone1} and Drone ${c.drone2} at ${c.time.toFixed(2)}s`)
    .join('<br>');
};

const updateSpeedWarningsList = () => {
  const speedList = $('speed-warnings');
  if (!speedList) return;
  speedList.innerHTML = state.speedWarnings
    .map(w => `Drone ${w.droneId} at ${w.time.toFixed(2)}s (${w.speed.toFixed(2)} m/s)`)
    .join('<br>');
};

/// ---------------------------
/// UI event handlers & setup
/// ---------------------------

/** wire play/pause button */
const setupPlayPause = () => {
  const btn = $('play-pause');
  if (!btn) return;
  btn.addEventListener('click', () => {
    state.isPlaying = !state.isPlaying;
    btn.textContent = state.isPlaying ? 'Pause' : 'Play';
  });
};

/** wire restart button */
const setupRestart = () => {
  const btn = $('restart');
  if (!btn) return;
  btn.addEventListener('click', () => {
    state.currentTime = 0;
    const timeline = $('timeline');
    if (timeline) timeline.value = 0;
    const timeDisplay = $('time-display');
    if (timeDisplay) timeDisplay.textContent = formatTime(state.currentTime);
    updateDrones(state.currentTime);
  });
};

/** wire timeline scrubber */
const setupTimeline = () => {
  const timeline = $('timeline');
  if (!timeline) return;
  timeline.addEventListener('input', (e) => {
    state.currentTime = (e.target.value / 100) * state.maxTime;
    const timeDisplay = $('time-display');
    if (timeDisplay) timeDisplay.textContent = formatTime(state.currentTime);
    updateDrones(state.currentTime);
  });
};

/** master setup for all UI events; called once on window load */
const setupEvents = () => {
  // attach UI events
  setupPlayPause();
  setupRestart();
  setupTimeline();

  // initialize scene and start rendering
  // call initSequence which performs data load and scene construction
  initSequence().catch(err => {
    // simple error message so user sees issues in console
    console.error('Initialization failed:', err);
  });
};


/** main animation frame, uses renderer.setAnimationLoop */
const startAnimationLoop = () => {
  // keep same clock semantics as original
  state.renderer.setAnimationLoop(() => {
    if (state.isPlaying) {
      state.currentTime += state.clock.getDelta();
      if (state.currentTime > state.maxTime) {
        state.currentTime = state.maxTime;
        state.isPlaying = false; // stop playing at end
        const btn = $('play-pause');
        if (btn) btn.textContent = 'Play';
      }
      const timeline = $('timeline');
      if (timeline) timeline.value = (state.currentTime / state.maxTime) * 100;
      const timeDisplay = $('time-display');
      if (timeDisplay) timeDisplay.textContent = formatTime(state.currentTime);
      updateDrones(state.currentTime);
    }
    state.renderer.render(state.scene, state.camera);
  });
};


/** orchestrates the loading and creation steps in a clear order */
const initSequence = async () => {
  // load JSON data first
  await loadData('/data/waypoints3.json');

  // create renderer and camera, set resize handling
  createRendererAndCamera();
  setupResizeHandler();

  // add controls, lights, ground, skybox
  addControlsAndLights();
  addGround();
  addSkybox();

  // load model and instantiate drones, draw trajectories
  loadDroneModelAndInstantiate();
  drawTrajectories();

  // start animation loop (clock already created)
  startAnimationLoop();
};

window.addEventListener('load', setupEvents);
