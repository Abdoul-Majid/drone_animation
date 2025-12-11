import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

(async () => {
  const dronesData = await fetch('/data/waypoints3.json').then(res => res.json());
  const framerate = dronesData.framerate;
  const drones = dronesData.drones;
  const scaleFactor = 0.01;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
  camera.position.set(0, 10, 30);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const controls = new OrbitControls(camera, renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0xffffff, 0.8);
  pointLight.position.set(10, 10, 10);
  scene.add(pointLight);

  const droneModels = [];
  const loader = new OBJLoader();

  const groundTexture = new THREE.TextureLoader().load('models/sol.jpg');
  groundTexture.wrapS = THREE.RepeatWrapping;
  groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(10, 10);
  const groundMaterial = new THREE.MeshPhongMaterial({ map: groundTexture });
  const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  const skyboxTexture = new THREE.TextureLoader().load('models/ciel.jpg');
  const skyboxGeometry = new THREE.BoxGeometry(5000, 5000, 5000);
  const skyboxMaterial = new THREE.MeshBasicMaterial({
    map: skyboxTexture,
    side: THREE.BackSide
  });
  const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
  scene.add(skybox);

  loader.load('models/drone.obj', (object) => {
    object.scale.set(0.5, 0.5, 0.5);

    drones.forEach((droneData) => {
      const drone = object.clone();
      const initialPosition = droneData.waypoints[0].position;
      drone.position.set(
        initialPosition.lng_X * scaleFactor,
        initialPosition.alt_Y * scaleFactor,
        initialPosition.lat_Z * scaleFactor
      );
      scene.add(drone);
      droneModels.push({ model: drone, waypoints: droneData.waypoints, previousPosition: null });
    });
  });

  const drawTrajectories = () => {
    drones.forEach((droneData) => {
      const waypoints = droneData.waypoints.map(wp => {
        const pos = wp.position;
        return new THREE.Vector3(
          pos.lng_X * scaleFactor,
          pos.alt_Y * scaleFactor,
          pos.lat_Z * scaleFactor
        );
      });

      const geometry = new THREE.BufferGeometry().setFromPoints(waypoints);
      const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
      const line = new THREE.Line(geometry, material);
      scene.add(line);
    });
  };
  drawTrajectories();

});