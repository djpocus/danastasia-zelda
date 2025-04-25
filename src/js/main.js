import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import nipplejs from 'nipplejs';

// Game state
const gameState = {
    player: null,
    camera: null,
    scene: null,
    renderer: null,
    world: null,
    controls: null,
    joystick: null,
    quests: [],
    npcs: [],
    loadingManager: null,
    cameraDistance: 5,
    cameraAngle: 0,
    cameraHeight: 2,
    animations: {},
    mixer: null,
    clock: new THREE.Clock(),
    currentAnimation: 'idle'
};

// Initialize the game
async function init() {
    setupLoadingManager();
    setupScene();
    setupPhysics();
    setupControls();
    await loadAssets();
    setupGameSystems();
    hideLoadingScreen();
    animate();
}

// Setup loading manager
function setupLoadingManager() {
    gameState.loadingManager = new THREE.LoadingManager();
    gameState.loadingManager.onProgress = (url, loaded, total) => {
        const progress = (loaded / total) * 100;
        document.querySelector('.progress').style.width = `${progress}%`;
    };
}

// Setup the Three.js scene
function setupScene() {
    // Scene
    gameState.scene = new THREE.Scene();
    gameState.scene.background = new THREE.Color(0x87CEEB); // Sky blue background

    // Camera
    gameState.camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    gameState.camera.position.set(0, 2, 5);

    // Renderer
    gameState.renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('game-canvas'),
        antialias: true
    });
    gameState.renderer.setSize(window.innerWidth, window.innerHeight);
    gameState.renderer.setPixelRatio(window.devicePixelRatio);
    gameState.renderer.shadowMap.enabled = true;
    gameState.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    gameState.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    gameState.scene.add(directionalLight);
}

// Setup physics world
function setupPhysics() {
    gameState.world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.82, 0)
    });
}

// Setup controls
function setupControls() {
    gameState.controls = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        isRotating: false,
        lastMouseX: 0
    };

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
        switch(e.code) {
            case 'KeyW': gameState.controls.forward = true; break;
            case 'KeyS': gameState.controls.backward = true; break;
            case 'KeyA': gameState.controls.left = true; break;
            case 'KeyD': gameState.controls.right = true; break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch(e.code) {
            case 'KeyW': gameState.controls.forward = false; break;
            case 'KeyS': gameState.controls.backward = false; break;
            case 'KeyA': gameState.controls.left = false; break;
            case 'KeyD': gameState.controls.right = false; break;
        }
    });

    // Mouse controls for camera rotation
    const canvas = gameState.renderer.domElement;
    
    canvas.addEventListener('mousedown', (e) => {
        gameState.controls.isRotating = true;
        gameState.controls.lastMouseX = e.clientX;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (gameState.controls.isRotating) {
            const deltaX = e.clientX - gameState.controls.lastMouseX;
            gameState.cameraAngle += deltaX * 0.01;
            gameState.controls.lastMouseX = e.clientX;
        }
    });

    canvas.addEventListener('mouseup', () => {
        gameState.controls.isRotating = false;
    });

    canvas.addEventListener('mouseleave', () => {
        gameState.controls.isRotating = false;
    });

    // Touch controls for mobile
    canvas.addEventListener('touchstart', (e) => {
        gameState.controls.isRotating = true;
        gameState.controls.lastMouseX = e.touches[0].clientX;
    });

    canvas.addEventListener('touchmove', (e) => {
        if (gameState.controls.isRotating) {
            const deltaX = e.touches[0].clientX - gameState.controls.lastMouseX;
            gameState.cameraAngle += deltaX * 0.01;
            gameState.controls.lastMouseX = e.touches[0].clientX;
        }
    });

    canvas.addEventListener('touchend', () => {
        gameState.controls.isRotating = false;
    });

    // Mobile joystick
    if (window.innerWidth <= 768) {
        gameState.joystick = nipplejs.create({
            zone: document.getElementById('joystick'),
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white'
        });

        gameState.joystick.on('move', (evt, data) => {
            const angle = data.angle.radian;
            gameState.controls.forward = data.force > 0.1 && Math.abs(Math.sin(angle)) > 0.5;
            gameState.controls.backward = data.force > 0.1 && Math.abs(Math.sin(angle)) > 0.5 && Math.sin(angle) < 0;
            gameState.controls.left = data.force > 0.1 && Math.abs(Math.cos(angle)) > 0.5 && Math.cos(angle) < 0;
            gameState.controls.right = data.force > 0.1 && Math.abs(Math.cos(angle)) > 0.5 && Math.cos(angle) > 0;
        });

        gameState.joystick.on('end', () => {
            gameState.controls.forward = false;
            gameState.controls.backward = false;
            gameState.controls.left = false;
            gameState.controls.right = false;
        });
    }
}

// Load game assets
async function loadAssets() {
    const loader = new GLTFLoader(gameState.loadingManager);
    
    try {
        console.log('Starting to load character model...');
        
        // Load character model
        const characterResult = await loader.loadAsync('assets/models/character.glb');
        console.log('Character model loaded successfully:', characterResult);
        
        gameState.player = characterResult.scene;
        console.log('Player scene created:', gameState.player);
        
        // Configure character model
        gameState.player.traverse((child) => {
            if (child.isMesh) {
                console.log('Configuring mesh:', child.name);
                // Enable shadows
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Set up materials
                if (child.material) {
                    console.log('Material found:', child.material);
                    child.material.roughness = 0.7;
                    child.material.metalness = 0.3;
                } else {
                    console.log('No material found for mesh:', child.name);
                    // Add a default material if none exists
                    child.material = new THREE.MeshStandardMaterial({
                        color: 0x00ff00,
                        roughness: 0.7,
                        metalness: 0.3
                    });
                }
            }
        });
        
        // Set up character physics
        const characterShape = new CANNON.Box(new CANNON.Vec3(0.5, 1, 0.5));
        const characterBody = new CANNON.Body({ mass: 1 });
        characterBody.addShape(characterShape);
        characterBody.position.copy(gameState.player.position);
        gameState.world.addBody(characterBody);
        
        // Position character
        gameState.player.position.set(0, 0, 0);
        gameState.player.scale.set(1, 1, 1);
        
        // Add character to scene
        gameState.scene.add(gameState.player);
        console.log('Player added to scene');
        
        // Load animations
        console.log('Loading animations...');
        const [idleResult, runningResult] = await Promise.all([
            loader.loadAsync('assets/animations/Animation_Idle_03_withSkin.glb'),
            loader.loadAsync('assets/animations/Animation_Running_withSkin.glb')
        ]);
        console.log('Animations loaded successfully');
        
        // Set up animation mixer and actions
        gameState.mixer = new THREE.AnimationMixer(gameState.player);
        gameState.animations = {
            idle: gameState.mixer.clipAction(idleResult.animations[0]),
            running: gameState.mixer.clipAction(runningResult.animations[0])
        };
        
        // Configure animations
        Object.values(gameState.animations).forEach(action => {
            action.setEffectiveWeight(1);
            action.setEffectiveTimeScale(1);
            action.play();
            action.paused = true;
        });
        
        // Start with idle animation
        gameState.animations.idle.paused = false;
        gameState.currentAnimation = 'idle';
        
        console.log('Animation system configured');

        // Create basic environment
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x3a5f0b,
            side: THREE.DoubleSide
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        gameState.scene.add(ground);

        // Load tree model
        console.log('Loading tree model...');
        const treeResult = await loader.loadAsync('assets/models/environment/low_polygon_tree_0424033052.glb');
        console.log('Tree model loaded successfully');

        // Calculate tree model's bounding box
        const treeBoundingBox = new THREE.Box3().setFromObject(treeResult.scene);
        const treeHeight = treeBoundingBox.max.y - treeBoundingBox.min.y;
        console.log('Tree height:', treeHeight);

        // Add trees to the scene
        for (let i = 0; i < 20; i++) {
            const tree = treeResult.scene.clone();
            
            // Randomize tree scale
            const scale = 3.0 + Math.random() * 1.0;
            tree.scale.set(scale, scale, scale);
            
            // Position tree based on its bounding box
            const scaledHeight = treeHeight * scale;
            tree.position.set(
                Math.random() * 80 - 40,
                scaledHeight / 2,  // Position at half height to place base on ground
                Math.random() * 80 - 40
            );
            
            // Randomize tree rotation
            tree.rotation.y = Math.random() * Math.PI * 2;
            
            // Configure tree for shadows
            tree.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            gameState.scene.add(tree);
        }

        console.log('Environment setup complete');

    } catch (error) {
        console.error('Error loading assets:', error);
        // Fallback to basic cube if model fails to load
        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        gameState.player = new THREE.Mesh(geometry, material);
        gameState.player.position.set(0, 1, 0);
        gameState.scene.add(gameState.player);
        console.log('Using fallback cube model');
    }
}

// Setup game systems
function setupGameSystems() {
    // Initialize quest system
    gameState.quests = [
        {
            id: 1,
            title: "Welcome to the Forest",
            description: "Find the village elder",
            completed: false,
            reward: "100 gold"
        }
    ];

    // Update quest log UI
    updateQuestLog();
}

// Update quest log UI
function updateQuestLog() {
    const questList = document.getElementById('quest-list');
    questList.innerHTML = gameState.quests
        .map(quest => `
            <div class="quest-item ${quest.completed ? 'completed' : ''}">
                <h4>${quest.title}</h4>
                <p>${quest.description}</p>
            </div>
        `)
        .join('');
}

// Hide loading screen
function hideLoadingScreen() {
    document.getElementById('loading-screen').style.display = 'none';
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = gameState.clock.getDelta();

    // Update animations
    if (gameState.mixer) {
        gameState.mixer.update(deltaTime);
    }

    // Update physics
    gameState.world.step(1/60);

    // Player movement
    if (gameState.player) {
        const moveSpeed = 0.1;
        let isMoving = false;
        
        // Calculate movement direction based on camera angle
        const forwardX = Math.sin(gameState.cameraAngle);
        const forwardZ = Math.cos(gameState.cameraAngle);
        
        if (gameState.controls.forward) {
            gameState.player.position.x += forwardX * moveSpeed;
            gameState.player.position.z += forwardZ * moveSpeed;
            isMoving = true;
        }
        if (gameState.controls.backward) {
            gameState.player.position.x -= forwardX * moveSpeed;
            gameState.player.position.z -= forwardZ * moveSpeed;
            isMoving = true;
        }
        if (gameState.controls.left) {
            gameState.player.position.x += forwardZ * moveSpeed;
            gameState.player.position.z -= forwardX * moveSpeed;
            isMoving = true;
        }
        if (gameState.controls.right) {
            gameState.player.position.x -= forwardZ * moveSpeed;
            gameState.player.position.z += forwardX * moveSpeed;
            isMoving = true;
        }

        // Update player rotation to face movement direction
        if (isMoving) {
            gameState.player.rotation.y = gameState.cameraAngle;
            // Switch to running animation
            if (gameState.currentAnimation !== 'running') {
                gameState.animations.idle.paused = true;
                gameState.animations.running.paused = false;
                gameState.currentAnimation = 'running';
            }
        } else {
            // Switch to idle animation
            if (gameState.currentAnimation !== 'idle') {
                gameState.animations.running.paused = true;
                gameState.animations.idle.paused = false;
                gameState.currentAnimation = 'idle';
            }
        }

        // Update camera position based on player position and camera angle
        gameState.camera.position.x = gameState.player.position.x - Math.sin(gameState.cameraAngle) * gameState.cameraDistance;
        gameState.camera.position.z = gameState.player.position.z - Math.cos(gameState.cameraAngle) * gameState.cameraDistance;
        gameState.camera.position.y = gameState.player.position.y + gameState.cameraHeight;
        
        // Make camera look at player
        gameState.camera.lookAt(gameState.player.position);
    }

    // Render scene
    gameState.renderer.render(gameState.scene, gameState.camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    gameState.camera.aspect = window.innerWidth / window.innerHeight;
    gameState.camera.updateProjectionMatrix();
    gameState.renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start the game
init(); 