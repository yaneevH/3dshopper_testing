import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
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

// Add ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

// Load environment map
new THREE.TextureLoader().load('./env.jpg', (equirectangularMap) => {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envMapRenderTarget = pmremGenerator.fromEquirectangular(equirectangularMap);
    envMapRenderTarget.texture.encoding = THREE.sRGBEncoding;
    equirectangularMap.dispose();

    scene.environment = envMapRenderTarget.texture;
});

// Post-processing setup
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// OutlinePass setup
const outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
outlinePass.edgeStrength = 2.5;
outlinePass.edgeGlow = 1;
outlinePass.edgeThickness = 2;
outlinePass.pulsePeriod = 0;
outlinePass.visibleEdgeColor.set('#ffffff');
outlinePass.hiddenEdgeColor.set('#0011ff');
composer.addPass(outlinePass);

// FXAA Pass for anti-aliasing
const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
composer.addPass(fxaaPass);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let calloutObjects = [];
const infoSections = {};

// Load the external HTML file
fetch('./info.html')
    .then(response => response.text())
    .then(data => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(data, 'text/html');
        // Extract sections and store them in a dictionary
        doc.querySelectorAll('div[id^="!"]').forEach(section => {
            infoSections[section.id] = section.innerHTML;
        });
    });

// Load GLTF model and cameras
new GLTFLoader().load('./airburner_5p_referencehuman.glb', function (gltf) {
    const model = gltf.scene;
    const cameras = gltf.cameras;
    const objectsToHighlight = [];

    scene.add(model);

    console.log('Cameras:', cameras);

    // Find objects whose names start with '!'
    model.traverse((child) => {
        if (child.isMesh && child.name.startsWith('!')) {
            objectsToHighlight.push(child);
            calloutObjects.push(child);
        }
    });

    // Add objects to OutlinePass
    outlinePass.selectedObjects = objectsToHighlight;

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

    // Add Toggle Callouts button at the end
    const toggleCalloutsButton = document.createElement('button');
    toggleCalloutsButton.textContent = 'Toggle Callouts';
    toggleCalloutsButton.onclick = () => {
        toggleCallouts();
    };
    cameraButtonsContainer.appendChild(toggleCalloutsButton);

    let referenceHuman;
    model.traverse((child) => {
        if (child.name === 'ReferenceHuman_Object') {
            referenceHuman = child;
        }
    });

    window.fit = function () {
        cameraControls.fitToSphere(model, true);
    };

    window.toggleCallouts = function () {
        if (calloutObjects.length > 0) {
            const anyVisible = calloutObjects.some(obj => obj.visible);
            calloutObjects.forEach(obj => {
                obj.visible = !anyVisible;
            });
            // Force render update
            composer.render();
        } else {
            console.log("No callout objects found.");
        }
    };

    // Event listener for clicks
    renderer.domElement.addEventListener('click', onClick, false);

    // Function to handle click events
    function onClick(event) {
        // Remove existing info boxes
        document.querySelectorAll('#info-box').forEach(box => box.remove());

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(calloutObjects);

        if (intersects.length > 0) {
            const intersectedObject = intersects[0].object;
            showInfoBox(intersectedObject, event);
        }
    }

    function showInfoBox(object, event) {
        let infoBox = document.createElement('div');
        infoBox.id = 'info-box';
        infoBox.style.position = 'absolute';
        infoBox.style.width = '60%';
        infoBox.style.height = '20%';
        infoBox.style.left = '20%';
        infoBox.style.bottom = '20px';
        infoBox.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        infoBox.style.padding = '5px'; // Smaller padding
        infoBox.style.border = '1px solid #000';
        infoBox.style.zIndex = '1000';
        infoBox.style.display = 'flex';
        infoBox.style.flexDirection = 'column';
        infoBox.style.justifyContent = 'space-between';
        infoBox.style.alignItems = 'center';

        // Get the content from the loaded HTML sections
        const content = infoSections[object.name] || 'No information available';
        infoBox.innerHTML = `<div style="flex: 1; overflow-y: auto;">${content}</div><button id="close-info-box" style="margin-top: 10px;">Close</button>`;

        document.body.appendChild(infoBox);

        // Add event listener to close the info box
        document.getElementById('close-info-box').addEventListener('click', () => {
            infoBox.remove();
        });
    }

    composer.render(scene, camera);

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

        // Make callout objects always look at the camera
        calloutObjects.forEach((obj) => {
            obj.lookAt(camera.position);
        });

        requestAnimationFrame(anim);

        if (updated) {
            composer.render(delta);
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

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    fxaaPass.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
});
