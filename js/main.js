import * as THREE from "three"
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// Criar cena do threeJS
let cena = new THREE.Scene()
window.cena = cena

// Mixer reference (set when model loads)
let gltfMixer = null

// Criar Renderer
const threeCanvas = document.getElementById('three-canvas');

// Crie o renderer com antialias e pixel ratio do dispositivo para bordas mais nítidas
let renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true })
// Don't set size here — we'll size to the canvas parent so the model stays inside the product column
renderer.setClearColor(0xffffff); // Cor de Fundo (Branco neste caso concreto)

// Ativar renderização de mapa de sombras
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

// Criar e preparar câmara (use a aspect ratio temporária; we'll update it on first resize)
let camara = new THREE.PerspectiveCamera(60, 1, 0.01, 1000)
let controls = new OrbitControls(camara, renderer.domElement)

//Posicão Padrão da Camara
camara.position.set(0.739, 0.356, -0.038)
// Reset any manual rotation so we rely on lookAt()/controls to orient the camera
camara.rotation.set(0, 0, 0)

// Usar a origem como alvo inicial dos controlos e atualizar os controlos para que a visualização corresponda
controls.target.set(0, 0, 0)
controls.update()

//Adicionar luz ambiente
const ambientLight = new THREE.AmbientLight(0xffffff, 3);
cena.add(ambientLight);

// Resize renderer to match the canvas parent (so the canvas is confined to the product column)
function resizeRendererToParent() {
    if (!threeCanvas) return;
    const parent = threeCanvas.parentElement;
    let width, height;

    if (parent) {
        const rect = parent.getBoundingClientRect();
        width = Math.max(1, Math.floor(rect.width));
        height = Math.max(1, Math.floor(rect.height));

        // Try to match the height of the product description column if it exists.
        // Instead of relying on a CSS class name, look for sibling columns inside the same row.
        try {
            // Prefer the row ancestor (commonly contains the two columns)
            const row = parent.closest && parent.closest('.row') ? parent.closest('.row') : parent.parentElement;
            if (row) {
                // Find the tallest sibling column different from the canvas parent
                const otherCols = Array.from(row.children).filter((el) => el !== parent);
                for (const col of otherCols) {
                    try {
                        const r = col.getBoundingClientRect();
                        if (r && r.height > height) {
                            height = Math.floor(r.height);
                        }
                    } catch (err) {
                        // ignore this sibling
                    }
                }
            } else {
                // fallback to previous sibling if no row found
                const sibling = parent.previousElementSibling;
                if (sibling) {
                    const siblingRect = sibling.getBoundingClientRect();
                    if (siblingRect && siblingRect.height > height) height = Math.floor(siblingRect.height);
                }
            }
        } catch (e) {
            // ignore failures here; we'll use the parent's height or default
        }

        // If parent has zero height (no layout yet), provide a sensible default
        if (height === 0) height = 480;
    } else {
        width = Math.max(1, window.innerWidth);
        height = Math.max(1, window.innerHeight);
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    // setSize with updateStyle=false so we control CSS separately
    renderer.setSize(width, height, false);

    // Ensure the canvas fills its parent visually
    threeCanvas.style.width = width + 'px';
    threeCanvas.style.height = height + 'px';

    camara.aspect = width / height;
    camara.updateProjectionMatrix();
}

// Adicionar listener de redimensionamento
window.addEventListener('resize', resizeRendererToParent, { passive: true });

// chame uma vez para definir o tamanho correto
resizeRendererToParent();

// Carregar modelo, ajustar luzes, e preparar cena exemplo
new GLTFLoader().load(
    //Caminho do Modelo
    './assets/models/RecordPlayer.glb',
    function (gltf) {
        // Informação: 1 Unidade = 0.1m = 1 dm = 10 cm
        cena.add(gltf.scene)

    // Create a mixer for the model animations and map named clips
    const mixer = new THREE.AnimationMixer(gltf.scene)
    gltfMixer = mixer

        // Find clips by exact names (as found in the glTF)
        const clipCover = gltf.animations.find(c => c.name === 'Closing and opening cover')
        const clipMoving = gltf.animations.find(c => c.name === 'Moving needle')
        const clipIdle = gltf.animations.find(c => c.name === 'Needle idle')

        const actionCover = clipCover ? mixer.clipAction(clipCover) : null
        const actionMoving = clipMoving ? mixer.clipAction(clipMoving) : null
        const actionIdle = clipIdle ? mixer.clipAction(clipIdle) : null

        // Configure idle action to loop but don't start it yet
        if (actionIdle) {
            actionIdle.setLoop(THREE.LoopRepeat, Infinity)
            actionIdle.clampWhenFinished = false
            actionIdle.enabled = true
        }

        // configure a simple state
        let spinning = false

        // helper to play the cover animation once
        function playCoverOnce() {
            if (!actionCover) return
            // Ensure other actions that target the same nodes are stopped/disabled
            try { if (actionMoving) { actionMoving.stop(); actionMoving.reset(); actionMoving.enabled = false; } } catch (e) {}
            try { if (actionIdle) { actionIdle.stop(); actionIdle.reset(); actionIdle.enabled = false; } } catch (e) {}

            // Reset and play cover action from start, forcing full weight
            try { actionCover.stop() } catch (e) {}
            actionCover.reset()
            actionCover.setLoop(THREE.LoopOnce, 0)
            actionCover.clampWhenFinished = true
            actionCover.enabled = true
            actionCover.setEffectiveWeight(1)
            actionCover.timeScale = 1
            actionCover.play()
        }

        // helper to play the moving animation once; forward=true for forward, false for reverse
        function playMovingOnce(forward = true) {
            if (!actionMoving) return
            // Ensure idle is stopped when we start the moving animation
            if (actionIdle && actionIdle.isRunning()) {
                actionIdle.stop()
            }
            // Ensure cover isn't interfering
            try { if (actionCover) { actionCover.stop(); actionCover.reset(); actionCover.enabled = false; } } catch (e) {}

            try { actionMoving.stop() } catch (e) {}
            actionMoving.reset()
            actionMoving.setLoop(THREE.LoopOnce, 0)
            actionMoving.clampWhenFinished = true
            actionMoving.enabled = true
            actionMoving.setEffectiveWeight(1)
            if (forward) {
                actionMoving.timeScale = 1
                actionMoving.play()
            } else {
                // play in reverse: set time to end and negative timescale
                actionMoving.time = actionMoving.getClip().duration
                actionMoving.timeScale = -1
                actionMoving.play()
            }
        }

        // When moving animation finishes, if it finished in forward direction, start idle looping
        mixer.addEventListener('finished', (e) => {
            // e.action is the action that finished
            if (e.action === actionMoving) {
                // If we finished forward (timescale > 0), start idle
                if (actionMoving.timeScale > 0) {
                    if (actionIdle) {
                        actionIdle.reset()
                        actionIdle.enabled = true
                        actionIdle.timeScale = 1
                        actionIdle.play()
                    }
                    spinning = true
                } else {
                    // finished in reverse
                    spinning = false
                }
            }
            // If cover finished, nothing automatic to do
        })

    // Raycaster + click handling to trigger animations
        const raycaster = new THREE.Raycaster()
        const pointer = new THREE.Vector2()

        function findNamedAncestor(object) {
            let cur = object
            while (cur) {
                if (cur.name && cur.name.length > 0) return cur.name
                cur = cur.parent
            }
            return null
        }

        function onPointerDownForAnimation(event) {
            if (!threeCanvas) return
            const rect = threeCanvas.getBoundingClientRect()
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

            raycaster.setFromCamera(pointer, camara)
            const intersects = raycaster.intersectObjects(gltf.scene.children, true)
            if (!intersects || intersects.length === 0) return
            const hit = intersects[0]
            const name = findNamedAncestor(hit.object)
            if (!name) return

            // Use exact glTF node names only
            const coverNames = new Set(['Cube007'])
            const pickupNames = new Set(['PickupBaseAttachment', 'VinylDisk'])

            if (coverNames.has(name)) {
                // play cover animation once
                playCoverOnce()
                return
            }

            if (pickupNames.has(name)) {
                if (!spinning) {
                    // play moving forward once, then start idle loop (handled in mixer.finished)
                    playMovingOnce(true)
                    // spinning will be set true in mixer finished handler
                } else {
                    // currently spinning: stop idle and play moving reversed once
                    if (actionIdle && actionIdle.isRunning()) actionIdle.stop()
                    playMovingOnce(false)
                    // spinning will be set false in mixer finished handler
                }
            }
        }

        if (threeCanvas) {
            threeCanvas.addEventListener('pointerdown', onPointerDownForAnimation, { passive: true })
        }

    // (debug globals removed)


        // Calcular o centro da caixa delimitadora do modelo e recentralizar os controlos/câmara
        try {
            const bbox = new THREE.Box3().setFromObject(gltf.scene);
            const modelCenter = new THREE.Vector3();
            bbox.getCenter(modelCenter);

            // Mover controls.target para o centro do modelo para que a órbita seja em torno do objeto
            controls.target.copy(modelCenter);

            // Compute a bounding sphere to determine a good camera distance
            const sphere = new THREE.Sphere();
            bbox.getBoundingSphere(sphere);
            const radius = sphere.radius || Math.max(bbox.getSize(new THREE.Vector3()).length() * 0.5, 1);

            const distance = radius * 1.8; // smaller factor => closer initial view

            const direction = new THREE.Vector3(85, 45, 1).normalize();
            const initialYawDeg = 0; // tweak this value (degrees) to rotate initial camera yaw (-90, 90, etc.)
            if (initialYawDeg !== 0) {
                const yawRad = THREE.MathUtils.degToRad(initialYawDeg);
                const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawRad);
                direction.applyQuaternion(q);
            }

            camara.position.copy(modelCenter).add(direction.multiplyScalar(distance));

            // Adjust near/far planes relative to distance
            camara.near = Math.max(0.01, distance * 0.001);
            camara.far = Math.max(1000, distance * 20);
            camara.updateProjectionMatrix();

            camara.lookAt(modelCenter);
            controls.update();

            // Restrict orbit distances so user doesn't zoom too close or too far
            controls.minDistance = Math.max(distance * 0.25, 0.05);
            controls.maxDistance = distance * 8;

            // camera repositioned
        } catch (err) {
            console.warn('Could not compute model center or reposition camera:', err);
        }
    }
)

// Renderizar/Animar

let delta = 0;
let relogio = new THREE.Clock();
let latencia_minima = 1 / 60; // para 60 frames por segundo 
animar()
function animar() {
    requestAnimationFrame(animar);
    delta += relogio.getDelta();

    if (delta < latencia_minima) return;

    // Atualize os helpers de luz, se existirem
    cena.traverse((child) => {
        if (child instanceof THREE.PointLightHelper || child instanceof THREE.SpotLightHelper || child instanceof THREE.DirectionalLightHelper) {
            child.update();
        }
    });

    // Update animations (if mixer was created when model loaded)
    try {
        if (gltfMixer) {
            // advance mixer by the accumulated delta
            gltfMixer.update(delta);
        }
    } catch (e) {
        // ignore mixer update errors
        // console.warn('mixer update error', e)
    }


    renderer.render(cena, camara)

    delta = delta % latencia_minima;
}




document.addEventListener('DOMContentLoaded', function () {
    const swipeWrap = document.querySelector('.swipe-wrap');
    const swipeItems = swipeWrap.querySelectorAll('.swipe-item');
    const leftArrow = document.getElementById('leftArrow');
    const rightArrow = document.getElementById('rightArrow');
    let currentIndex = 0;

    function showImage(index) {
        swipeItems.forEach((item, i) => {
            item.style.display = i === index ? 'block' : 'none';
        });
    }

    showImage(currentIndex);

    leftArrow.addEventListener('click', function () {
        currentIndex = (currentIndex > 0) ? currentIndex - 1 : swipeItems.length - 1;
        showImage(currentIndex);
    });

    rightArrow.addEventListener('click', function () {
        currentIndex = (currentIndex < swipeItems.length - 1) ? currentIndex + 1 : 0;
        showImage(currentIndex);
    });

});