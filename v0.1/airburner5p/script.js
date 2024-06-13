import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import CameraControls from 'camera-controls';

CameraControls.install({ THREE: THREE });

const clock = new THREE.Clock();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
camera.position.set(0, 0, 5);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('scene-canvas') });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.physicallyCorrectLights = true;
renderer.outputEncoding = THREE.sRGBEncoding;

const cameraControls = new CameraControls(camera, renderer.domElement);
window.cameraControls = cameraControls; // Make cameraControls globally accessible

// Generate buttons
const buttonContainer = document.getElementById('button-container');

const fitButton = document.createElement('button');
fitButton.type = 'button';
fitButton.textContent = 'Fit';
fitButton.onclick = () => window.fit();
buttonContainer.appendChild(fitButton);

const resetButton = document.createElement('button');
resetButton.type = 'button';
resetButton.textContent = 'Reset';
resetButton.onclick = () => window.cameraControls.reset(true);
buttonContainer.appendChild(resetButton);

const cameraButtonsContainer = document.createElement('div');
cameraButtonsContainer.id = 'camera-buttons';
cameraButtonsContainer.style.display = 'flex';
cameraButtonsContainer.style.alignItems = 'center';
buttonContainer.appendChild(cameraButtonsContainer);

// Load environment map
new THREE.TextureLoader().load('./env.jpg', (equirectangularMap) => {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envMapRenderTarget = pmremGenerator.fromEquirectangular(equirectangularMap);
    envMapRenderTarget.texture.encoding = THREE.sRGBEncoding;
    equirectangularMap.dispose();

    scene.environment = envMapRenderTarget.texture;
});

const gridHelper = new THREE.GridHelper(50, 50);
scene.add(gridHelper);

// Load GLTF model and cameras
new GLTFLoader().load('./airburner_5p_cameras.glb', function (gltf) {
    const model = gltf.scene;
    const cameras = gltf.cameras;

    scene.add(model);

    // Create buttons for each camera
    cameras.forEach((cam, index) => {
        const button = document.createElement('button');
        button.textContent = `Cam ${index + 1}`;
        button.onclick = () => fitToCamera(cam);
        cameraButtonsContainer.appendChild(button);
    });

    window.fit = function () {
        cameraControls.fitToSphere(model, true);
    };

    renderer.render(scene, camera);
});

const fitToCamera = (cam) => {
    const camPosition = new THREE.Vector3();
    cam.getWorldPosition(camPosition);

    const target = new THREE.Vector3();
    if (cam.target) {
        cam.target.getWorldPosition(target);
    } else {
        target.set(0, 0, 0); // Default target if not specified
    }

    cameraControls.setLookAt(
        camPosition.x, camPosition.y, camPosition.z,
        target.x, target.y, target.z,
        true
    );
};

renderer.render(scene, camera);

(function anim() {
    const delta = clock.getDelta();
    const updated = cameraControls.update(delta);

    requestAnimationFrame(anim);

    if (updated) {
        renderer.render(scene, camera);
    }
})();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
