import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import CameraControls from 'camera-controls';
CameraControls.install({ THREE: THREE });

const clock = new THREE.Clock();
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
camera.position.set(0, 5, 10);

const canvas = document.getElementById('scene-canvas');
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xf5f5f5, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.physicallyCorrectLights = true;
renderer.outputEncoding = THREE.sRGBEncoding;

const cameraControls = new CameraControls(camera, renderer.domElement);
window.cameraControls = cameraControls;

const gridHelper = new THREE.GridHelper(12, 12, 0x000000, 0x000000);
gridHelper.material.linewidth = 20;
scene.add(gridHelper);

const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

new THREE.TextureLoader().load('./env.jpg', (equirectangularMap) => {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envMapRenderTarget = pmremGenerator.fromEquirectangular(equirectangularMap);
    envMapRenderTarget.texture.encoding = THREE.sRGBEncoding;
    equirectangularMap.dispose();
    scene.environment = envMapRenderTarget.texture;
});

// Initial render and start the animation loop
renderer.render(scene, camera);
requestAnimationFrame(anim);

// Animation loop function
function anim() {
    const delta = clock.getDelta();
    const updated = cameraControls.update(delta);

    infopointObjects.forEach((obj) => {
        obj.lookAt(camera.position);
    });

    if (updated) {
        renderer.render(scene, camera);
    }

    requestAnimationFrame(anim); // Ensure the loop continues
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let infopointObjects = [];
const infoSections = {};

// Load the external HTML file
fetch('./info.html')
    .then(response => response.text())
    .then(data => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(data, 'text/html');
        doc.querySelectorAll('div[id^="!"]').forEach(section => {
            infoSections[section.id] = section.innerHTML;
        });
    });

function findInfopointAncestor(object) {
    while (object) {
        if (object.name.startsWith('!')) {
            return object;
        }
        object = object.parent;
    }
    return null;
}

new GLTFLoader().load('./airburner_5p_referencehuman.glb', function (gltf) {
    const model = gltf.scene;
    const cameras = gltf.cameras;

    scene.add(model);

    model.traverse((child) => {
        if (child.name.startsWith('!')) {
            infopointObjects.push(child);
        }
    });

    const cameraButtonsContainer = document.getElementById('camera-buttons');
    cameras.forEach((cam, index) => {
        const button = document.createElement('button');
        button.textContent = `Cam ${index + 1}`;
        button.onclick = () => {
            fitToCamera(cam);
        };
        cameraButtonsContainer.appendChild(button);
    });

    const toggleInfopointsButton = document.createElement('button');
    toggleInfopointsButton.textContent = 'Toggle Infopoints';
    toggleInfopointsButton.onclick = toggleInfopoints;
    cameraButtonsContainer.appendChild(toggleInfopointsButton);

    // Force render after model load to ensure visibility
    renderer.render(scene, camera);

    // Also trigger one more animation frame after loading
    requestAnimationFrame(anim);
});

window.toggleInfopoints = function () {
    if (infopointObjects.length > 0) {
        const anyVisible = infopointObjects.some(obj => obj.visible);
        infopointObjects.forEach(obj => {
            obj.visible = !anyVisible;
        });
        renderer.render(scene, camera);
    }
};

function onClick(event) {
    document.querySelectorAll('#info-box').forEach(box => box.remove());

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(infopointObjects, true);

    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        const infopointAncestor = findInfopointAncestor(intersectedObject);
        if (infopointAncestor) {
            showInfoBox(infopointAncestor, event);
        }
    }
}

function showInfoBox(object, event) {
    document.querySelectorAll('#info-box').forEach(box => box.remove());

    let infoBox = document.createElement('div');
    infoBox.id = 'info-box';
    infoBox.style.position = 'absolute';
    infoBox.style.width = '90%';
    infoBox.style.height = '30%';
    infoBox.style.bottom = '5px';
    infoBox.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    infoBox.style.padding = '3px';
    infoBox.style.border = '2px solid #000';
    infoBox.style.borderRadius = '10px';
    infoBox.style.fontFamily = 'Arial, Helvetica, sans-serif';
    infoBox.style.zIndex = '1000';
    infoBox.style.display = 'flex';
    infoBox.style.flexDirection = 'column';
    infoBox.style.justifyContent = 'space-between';
    infoBox.style.alignItems = 'center';
    infoBox.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';

    const content = infoSections[object.name] || '<h3>No information available</h3>';
    infoBox.innerHTML = `
    <div style="flex: 1; overflow-y: auto; position: relative; width: 100%;">
        ${content}
        <button id="close-info-box" style="
            position: absolute;
            top: 5px;
            right: 5px;
            padding: 5px 5px;
            background-color: #f0f0f0;
            border: 1px solid #000;
            cursor: pointer;
            font-family: Arial, Helvetica, sans-serif;">Close</button>
    </div>
    `;

    document.body.appendChild(infoBox);

    document.getElementById('close-info-box').addEventListener('click', () => {
        infoBox.remove();
    });
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
