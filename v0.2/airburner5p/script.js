import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import CameraControls from 'camera-controls';
CameraControls.install({ THREE: THREE });

const clock = new THREE.Clock();
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
camera.position.set(0, 5, 10); // Adjusted camera position for better view of the grid
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('scene-canvas') });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xBAE4E5, 1); // Set background color to light blue
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.physicallyCorrectLights = true;
renderer.outputEncoding = THREE.sRGBEncoding;

const cameraControls = new CameraControls(camera, renderer.domElement);
window.cameraControls = cameraControls; // Make cameraControls globally accessible

// Create a grid with size 12 (approximately 60% of 20) and thicker grid lines
const gridHelper = new THREE.GridHelper(12, 12, 0x000000, 0x000000);
gridHelper.material.linewidth = 10; // Thicker grid lines
scene.add(gridHelper);

// Load environment map
new THREE.TextureLoader().load('./env.jpg', (equirectangularMap) => {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envMapRenderTarget = pmremGenerator.fromEquirectangular(equirectangularMap);
    envMapRenderTarget.texture.encoding = THREE.sRGBEncoding;
    equirectangularMap.dispose();

    scene.environment = envMapRenderTarget.texture;
});

// Load GLTF model and cameras
new GLTFLoader().load('./airburner_5p_referencehuman.glb', function (gltf) {
    const model = gltf.scene;
    const cameras = gltf.cameras;

    scene.add(model);

    console.log('Cameras:', cameras);

    // Create buttons for each camera
    const cameraButtonsContainer = document.getElementById('camera-buttons');
    cameras.forEach((cam, index) => {
        console.log('Creating button for camera:', index);
        const button = document.createElement('button');
        button.textContent = `Cam ${index + 1}`;
        button.onclick = () => {
            fitToCamera(cam);
        };
        cameraButtonsContainer.appendChild(button);
    });

    let referenceHuman;
    model.traverse((child) => {
        if (child.name === 'ReferenceHuman_Object') {
            referenceHuman = child;
        }
    });

    window.fit = function () {
        cameraControls.fitToSphere(model, true);
    };

    renderer.render(scene, camera);

    (function anim() {
        const delta = clock.getDelta();
        const updated = cameraControls.update(delta);

        // Update rotation to face the camera (yaw only)
        if (referenceHuman) {
            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            const angle = Math.atan2(direction.x, direction.z);
            referenceHuman.rotation.y = angle;
        }

        requestAnimationFrame(anim);

        if (updated) {
            renderer.render(scene, camera);
        }
    })();
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

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
