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
renderer.setClearColor(0xf5f5f5, 1); // Set background color to light blue
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.physicallyCorrectLights = true;
renderer.outputEncoding = THREE.sRGBEncoding;

const cameraControls = new CameraControls(camera, renderer.domElement);
window.cameraControls = cameraControls; // Make cameraControls globally accessible

// Create a grid with size 12 (approximately 60% of 20) and thicker grid lines
const gridHelper = new THREE.GridHelper(12, 12, 0x000000, 0x000000);
gridHelper.material.linewidth = 20; // Thicker grid lines
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
        // Extract sections and store them in a dictionary
        doc.querySelectorAll('div[id^="!"]').forEach(section => {
            infoSections[section.id] = section.innerHTML;
        });
    });

// Load GLTF model and cameras
new GLTFLoader().load('./airburner_5p_referencehuman.glb', function (gltf) {
    const model = gltf.scene;
    const cameras = gltf.cameras;
    const highlightObjects = [];

    scene.add(model);

    console.log('Cameras:', cameras);


    // Find objects whose names start with '!'
    model.children.forEach((child) => {
        console.log("Top-level object:", child.name);
        // Check if the top-level object's name starts with '!'
        if (child.name.startsWith('!')) {
            // Add the child to infopointObjects or process it further
            infopointObjects.push(child);
            console.log('Adding top-level infopoint:', child.name);
        }
    });


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

    // Add Toggle Infopoints button at the end
    const toggleInfopointsButton = document.createElement('button');
    toggleInfopointsButton.textContent = 'Toggle Infopoints';
    toggleInfopointsButton.onclick = () => {
        toggleInfopoints();
    };
    cameraButtonsContainer.appendChild(toggleInfopointsButton);

    let referenceHuman;
    model.traverse((child) => {
        if (child.name === 'ReferenceHuman_Object') {
            referenceHuman = child;
        }
    });

    window.fit = function () {
        cameraControls.fitToSphere(model, true);
    };

    window.toggleInfopoints = function () {
        if (infopointObjects.length > 0) {
            const anyVisible = infopointObjects.some(obj => obj.visible);
            infopointObjects.forEach(obj => {
                obj.visible = !anyVisible;
            });
            // Force render update
            renderer.render(scene, camera);
        } else {
            console.log("No infopoint objects found.");
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
        const intersects = raycaster.intersectObjects(infopointObjects);

        if (intersects.length > 0) {
            const intersectedObject = intersects[0].object;
            showInfoBox(intersectedObject, event);
        }
    }

    function showInfoBox(object, event) {
        // Remove existing info boxes
        document.querySelectorAll('#info-box').forEach(box => box.remove());

        let infoBox = document.createElement('div');
        infoBox.id = 'info-box';
        infoBox.style.position = 'absolute';
        infoBox.style.width = '60%';
        infoBox.style.height = '30%';
        infoBox.style.left = '20%';
        infoBox.style.bottom = '5px';
        infoBox.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        infoBox.style.padding = '1px'; // Even smaller padding
        infoBox.style.border = '2px solid #000';
        infoBox.style.zIndex = '1000';
        infoBox.style.display = 'flex';
        infoBox.style.flexDirection = 'column';
        infoBox.style.justifyContent = 'space-between';
        infoBox.style.alignItems = 'center';

        // Get the content from the loaded HTML sections
        const content = infoSections[object.name] || '<h3>No information available</h3>';
        infoBox.innerHTML = `<div style="flex: 1; overflow-y: auto;">${content}</div><button id="close-info-box" style="margin-top: 2px;">Close</button>`;

        document.body.appendChild(infoBox);

        // Add event listener to close the info box
        document.getElementById('close-info-box').addEventListener('click', () => {
            infoBox.remove();
        });
    }

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

        // Make infopoint objects always look at the camera
        infopointObjects.forEach((obj) => {
            obj.lookAt(camera.position);
        });


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

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
