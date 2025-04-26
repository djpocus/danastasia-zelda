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
    currentAnimation: 'idle',
    physics: {
        bodies: {
            ground: null,
            trees: [],
            character: null
        },
        debug: {
            enabled: false,
            helpers: {
                ground: null,
                trees: [],
                character: null
            }
        },
        character: {
            canJump: true,
            jumpForce: 5,
            isGrounded: true
        }
    }
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
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    
    // Shadow settings to cover the entire 100x100 ground plane
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.camera.left = -60;
    directionalLight.shadow.camera.right = 60;
    directionalLight.shadow.camera.top = 60;
    directionalLight.shadow.camera.bottom = -60;
    directionalLight.shadow.bias = -0.0001;
    directionalLight.shadow.normalBias = 0.02;
    
    gameState.scene.add(directionalLight);
}

// Setup physics world
function setupPhysics() {
    console.log('Setting up physics...');
    
    gameState.world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.82, 0)
    });

    // Add collision detection
    gameState.world.addEventListener('beginContact', (event) => {
        if (event.bodyA === gameState.physics.bodies.character || 
            event.bodyB === gameState.physics.bodies.character) {
            // Check if collision is with ground or tree
            const otherBody = event.bodyA === gameState.physics.bodies.character ? event.bodyB : event.bodyA;
            if (otherBody === gameState.physics.bodies.ground) {
                gameState.physics.character.isGrounded = true;
            }
        }
    });

    // Create ground plane
    console.log('Creating ground plane...');
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({
        mass: 0,
        shape: groundShape
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    gameState.world.addBody(groundBody);
    gameState.physics.bodies.ground = groundBody;

    // Add debug visualization for ground
    if (gameState.physics.debug.enabled) {
        console.log('Creating ground debug visualization...');
        const groundHelper = createPhysicsDebugHelper(groundBody, 0xff0000);
        gameState.scene.add(groundHelper);
        gameState.physics.debug.helpers.ground = groundHelper;
    }
}

// Add debug visualization function
function createPhysicsDebugHelper(body, color = 0x00ff00) {
    let helper;
    if (body.shapes[0] instanceof CANNON.Plane) {
        // For ground plane - make it more visible
        const geometry = new THREE.PlaneGeometry(100, 100, 10, 10); // Add segments for better visibility
        const material = new THREE.MeshBasicMaterial({
            color: color,
            wireframe: true,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide // Make it visible from both sides
        });
        helper = new THREE.Mesh(geometry, material);
        helper.rotation.x = -Math.PI / 2;
    } else if (body.shapes[0] instanceof CANNON.Box) {
        // For character
        const shape = body.shapes[0];
        const geometry = new THREE.BoxGeometry(
            shape.halfExtents.x * 2,
            shape.halfExtents.y * 2,
            shape.halfExtents.z * 2
        );
        const material = new THREE.MeshBasicMaterial({
            color: color,
            wireframe: true,
            transparent: true,
            opacity: 0.5
        });
        helper = new THREE.Mesh(geometry, material);
    }
    return helper;
}

// Setup controls
function setupControls() {
    gameState.controls = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
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
            case 'Space': 
                if (gameState.physics.character.canJump && gameState.physics.character.isGrounded) {
                    gameState.controls.jump = true;
                    gameState.physics.character.canJump = false;
                    gameState.physics.character.isGrounded = false;
                }
                break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch(e.code) {
            case 'KeyW': gameState.controls.forward = false; break;
            case 'KeyS': gameState.controls.backward = false; break;
            case 'KeyA': gameState.controls.left = false; break;
            case 'KeyD': gameState.controls.right = false; break;
            case 'Space': 
                gameState.controls.jump = false;
                gameState.physics.character.canJump = true;
                break;
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
    const baseURL = '/danastasia-zelda';
    
    try {
        console.log('Starting to load character model...');
        
        // Load character model with error handling
        try {
            const characterResult = await loader.loadAsync(`${baseURL}/models/character.glb`);
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
                        child.material.shadowSide = THREE.DoubleSide;
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
            
            // Add physics body to character with size that encompasses the whole model
            const characterShape = new CANNON.Box(new CANNON.Vec3(0.3, 0.6, 0.3));
            const characterBody = new CANNON.Body({
                mass: 5,
                shape: characterShape,
                position: new CANNON.Vec3(0, 0.6, 0),
                fixedRotation: true,
                linearDamping: 0.9,
                angularDamping: 0.9
            });
            
            // Add contact material for better ground interaction
            const characterMaterial = new CANNON.Material('character');
            const groundMaterial = new CANNON.Material('ground');
            characterBody.material = characterMaterial;
            gameState.physics.bodies.ground.material = groundMaterial;
            
            const characterGroundContact = new CANNON.ContactMaterial(
                characterMaterial,
                groundMaterial,
                {
                    friction: 0.5,
                    restitution: 0.0
                }
            );
            gameState.world.addContactMaterial(characterGroundContact);
            
            gameState.world.addBody(characterBody);
            gameState.physics.bodies.character = characterBody;

            // Position character at ground level
            gameState.player.position.set(0, 0, 0);
            gameState.player.scale.set(1, 1, 1);
            
            // Add character to scene
            gameState.scene.add(gameState.player);
            console.log('Player added to scene');
            
            // Load animations with error handling
            console.log('Loading animations...');
            try {
                const [idleResult, runningResult] = await Promise.all([
                    loader.loadAsync(`${baseURL}/animations/Animation_Idle_03_withSkin.glb`),
                    loader.loadAsync(`${baseURL}/animations/Animation_Running_withSkin.glb`)
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

            } catch (animError) {
                console.error('Error loading animations:', animError);
                // Continue without animations if they fail to load
            }

            // Create basic environment
            const groundGeometry = new THREE.PlaneGeometry(100, 100);
            const groundVisualMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x3a5f0b,
                side: THREE.DoubleSide
            });
            const ground = new THREE.Mesh(groundGeometry, groundVisualMaterial);
            ground.rotation.x = -Math.PI / 2;
            ground.position.y = 0;
            ground.receiveShadow = true;
            gameState.scene.add(ground);

            // Load tree models with error handling
            console.log('Loading tree models...');
            try {
                const [treeResult1, treeResult2, treeResult3] = await Promise.all([
                    loader.loadAsync(`${baseURL}/models/environment/low_polygon_tree_0424033052.glb`),
                    loader.loadAsync(`${baseURL}/models/environment/make_me_a_low_poly_tr_0425195522.glb`),
                    loader.loadAsync(`${baseURL}/models/environment/Low_Poly_Tree_in_a_fa_0425195043.glb`)
                ]);
                console.log('Tree models loaded successfully');

                // Calculate bounding boxes for all tree types
                const treeBoundingBox1 = new THREE.Box3().setFromObject(treeResult1.scene);
                const treeHeight1 = treeBoundingBox1.max.y - treeBoundingBox1.min.y;
                const treeWidth1 = treeBoundingBox1.max.x - treeBoundingBox1.min.x;

                const treeBoundingBox2 = new THREE.Box3().setFromObject(treeResult2.scene);
                const treeHeight2 = treeBoundingBox2.max.y - treeBoundingBox2.min.y;
                const treeWidth2 = treeBoundingBox2.max.x - treeBoundingBox2.min.x;

                const treeBoundingBox3 = new THREE.Box3().setFromObject(treeResult3.scene);
                const treeHeight3 = treeBoundingBox3.max.y - treeBoundingBox3.min.y;
                const treeWidth3 = treeBoundingBox3.max.x - treeBoundingBox3.min.x;

                // Add trees to the scene
                for (let i = 0; i < 40; i++) {
                    // Randomly choose tree type (equal probability for each type)
                    const treeType = Math.floor(Math.random() * 3); // 0, 1, or 2
                    let treeResult, treeHeight, treeWidth;
                    
                    switch(treeType) {
                        case 0:
                            treeResult = treeResult1;
                            treeHeight = treeHeight1;
                            treeWidth = treeWidth1;
                            break;
                        case 1:
                            treeResult = treeResult2;
                            treeHeight = treeHeight2;
                            treeWidth = treeWidth2;
                            break;
                        case 2:
                            treeResult = treeResult3;
                            treeHeight = treeHeight3;
                            treeWidth = treeWidth3;
                            break;
                    }
                    
                    const tree = treeResult.scene.clone();
                    
                    // Randomize tree scale based on type with additional random variation
                    let scale;
                    const sizeVariation = 0.8 + Math.random() * 0.4; // Random between 0.8 and 1.2 (80% to 120%)
                    
                    if (treeType === 1) { // Second tree type (taller variant)
                        const baseScale = (1.4 + Math.random() * 0.45) * sizeVariation; // Reduced by another 20% (from 1.75 + random * 0.56)
                        const heightIncrease = 1.3 + Math.random() * 0.2; // Random 30-50% increase
                        tree.scale.set(baseScale, baseScale * heightIncrease, baseScale);
                        var scaledHeight = treeHeight * (baseScale * heightIncrease);
                        var scaledWidth = treeWidth * baseScale;
                    } else if (treeType === 2) { // Third tree type
                        scale = (2.8 + Math.random() * 0.9) * sizeVariation;
                        tree.scale.set(scale, scale, scale);
                        var scaledHeight = treeHeight * scale;
                        var scaledWidth = treeWidth * scale;
                    } else { // First tree type (original)
                        scale = (3.0 + Math.random() * 1.0) * sizeVariation;
                        tree.scale.set(scale, scale, scale);
                        var scaledHeight = treeHeight * scale;
                        var scaledWidth = treeWidth * scale;
                    }
                    
                    // Position tree based on its bounding box
                    tree.position.set(
                        Math.random() * 80 - 40,
                        scaledHeight / 2,
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

                    // Add physics body for tree
                    const treeShape = new CANNON.Cylinder(
                        (scaledWidth * 0.5) / 2,
                        (scaledWidth * 0.5) / 2,
                        scaledHeight,
                        8
                    );
                    const treeBody = new CANNON.Body({
                        mass: 0,
                        shape: treeShape,
                        position: new CANNON.Vec3(
                            tree.position.x,
                            tree.position.y,
                            tree.position.z
                        )
                    });
                    gameState.world.addBody(treeBody);
                    gameState.physics.bodies.trees.push(treeBody);

                    // Add debug visualization for tree
                    if (gameState.physics.debug.enabled) {
                        // Removed tree debug visualization while keeping physics bodies
                        gameState.physics.debug.helpers.trees.push(null);
                    }
                }

                // Add debug visualization for character
                if (gameState.physics.debug.enabled) {
                    console.log('Creating character debug visualization...');
                    const characterHelper = createPhysicsDebugHelper(characterBody, 0xffff00);
                    gameState.scene.add(characterHelper);
                    gameState.physics.debug.helpers.character = characterHelper;
                }

                console.log('Environment setup complete');

            } catch (treeError) {
                console.error('Error loading tree models:', treeError);
                // Continue without trees if they fail to load
            }

        } catch (characterError) {
            console.error('Error loading character model:', characterError);
            // Fallback to basic cube if model fails to load
            const geometry = new THREE.BoxGeometry(1, 2, 1);
            const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
            gameState.player = new THREE.Mesh(geometry, material);
            gameState.player.position.set(0, 1, 0);
            gameState.scene.add(gameState.player);
            console.log('Using fallback cube model');
        }

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
    const fixedTimeStep = 1.0 / 60.0;

    // Step the physics world
    gameState.world.step(fixedTimeStep);

    // Handle character movement and jumping
    if (gameState.physics.bodies.character && gameState.player) {
        const moveSpeed = 0.1;
        let isMoving = false;
        
        // Calculate movement direction based on camera angle
        const forwardX = Math.sin(gameState.cameraAngle);
        const forwardZ = Math.cos(gameState.cameraAngle);
        
        // Handle jump
        if (gameState.controls.jump && gameState.physics.character.isGrounded) {
            console.log('Jumping!'); // Debug log
            gameState.physics.bodies.character.velocity.y = gameState.physics.character.jumpForce;
            gameState.physics.character.isGrounded = false;
        }

        // Check if character is on ground (using velocity)
        if (Math.abs(gameState.physics.bodies.character.velocity.y) < 0.001) {
            gameState.physics.character.isGrounded = true;
        }

        // Calculate new position based on controls
        const newPosition = new THREE.Vector3(
            gameState.physics.bodies.character.position.x,
            gameState.physics.bodies.character.position.y,
            gameState.physics.bodies.character.position.z
        );

        if (gameState.controls.forward) {
            newPosition.x += forwardX * moveSpeed;
            newPosition.z += forwardZ * moveSpeed;
            isMoving = true;
        }
        if (gameState.controls.backward) {
            newPosition.x -= forwardX * moveSpeed;
            newPosition.z -= forwardZ * moveSpeed;
            isMoving = true;
        }
        if (gameState.controls.left) {
            newPosition.x += forwardZ * moveSpeed;
            newPosition.z -= forwardX * moveSpeed;
            isMoving = true;
        }
        if (gameState.controls.right) {
            newPosition.x -= forwardZ * moveSpeed;
            newPosition.z += forwardX * moveSpeed;
            isMoving = true;
        }

        // Update physics body position (x and z only, let physics handle y)
        gameState.physics.bodies.character.position.x = newPosition.x;
        gameState.physics.bodies.character.position.z = newPosition.z;
        
        // Update visual model position
        gameState.player.position.copy(newPosition);
        gameState.player.position.y = Math.max(0, gameState.physics.bodies.character.position.y - 0.6);
        
        // Update player rotation and animation
        if (isMoving) {
            gameState.player.rotation.y = gameState.cameraAngle;
            if (gameState.currentAnimation !== 'running') {
                gameState.animations.idle.paused = true;
                gameState.animations.running.paused = false;
                gameState.currentAnimation = 'running';
            }
        } else {
            if (gameState.currentAnimation !== 'idle') {
                gameState.animations.running.paused = true;
                gameState.animations.idle.paused = false;
                gameState.currentAnimation = 'idle';
            }
        }

        // Update debug visualization
        if (gameState.physics.debug.enabled && gameState.physics.debug.helpers.character) {
            gameState.physics.debug.helpers.character.position.copy(gameState.physics.bodies.character.position);
            gameState.physics.debug.helpers.character.quaternion.copy(gameState.physics.bodies.character.quaternion);
        }
    }

    // Update animations
    if (gameState.mixer) {
        gameState.mixer.update(deltaTime);
    }

    // Update camera position
    if (gameState.player) {
        gameState.camera.position.x = gameState.player.position.x - Math.sin(gameState.cameraAngle) * gameState.cameraDistance;
        gameState.camera.position.z = gameState.player.position.z - Math.cos(gameState.cameraAngle) * gameState.cameraDistance;
        gameState.camera.position.y = gameState.player.position.y + gameState.cameraHeight;
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