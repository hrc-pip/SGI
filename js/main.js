import * as THREE from "three"
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

let cena = new THREE.Scene()
window.cena = cena

let gltfMixer = null

const threeCanvas = document.getElementById('three-canvas');

let renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true })
renderer.setClearColor(0xffffff);

renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

let camara = new THREE.PerspectiveCamera(60, 1, 0.01, 1000)
let controls = new OrbitControls(camara, renderer.domElement)

//Posicão Padrão da Camara
camara.position.set(0.739, 0.356, -0.038)
camara.rotation.set(0, 0, 0)

controls.target.set(0, 0, 0)
controls.update()

const ambientLight = new THREE.AmbientLight(0xffffff, 3);
cena.add(ambientLight);

function resizeRendererToParent() {
    if (!threeCanvas) return;
    const parent = threeCanvas.parentElement;
    let width, height;

    if (parent) {
        const rect = parent.getBoundingClientRect();
        width = Math.max(1, Math.floor(rect.width));
        height = Math.max(1, Math.floor(rect.height));

        try {
            const row = parent.closest && parent.closest('.row') ? parent.closest('.row') : parent.parentElement;
            if (row) {
                const otherCols = Array.from(row.children).filter((el) => el !== parent);
                for (const col of otherCols) {
                    try {
                        const r = col.getBoundingClientRect();
                        if (r && r.height > height) {
                            height = Math.floor(r.height);
                        }
                    } catch (err) {
                    }
                }
            } else {
                const sibling = parent.previousElementSibling;
                if (sibling) {
                    const siblingRect = sibling.getBoundingClientRect();
                    if (siblingRect && siblingRect.height > height) height = Math.floor(siblingRect.height);
                }
            }
        } catch (e) {
        }

        if (height === 0) height = 480;
    } else {
        width = Math.max(1, window.innerWidth);
        height = Math.max(1, window.innerHeight);
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);

    threeCanvas.style.width = width + 'px';
    threeCanvas.style.height = height + 'px';

    camara.aspect = width / height;
    camara.updateProjectionMatrix();
}

window.addEventListener('resize', resizeRendererToParent, { passive: true });

resizeRendererToParent();

new GLTFLoader().load(
    './assets/models/RecordPlayer.glb',
    function (gltf) {
        cena.add(gltf.scene)

        const mixer = new THREE.AnimationMixer(gltf.scene)
        gltfMixer = mixer

        const clipCover = gltf.animations.find(c => c.name === 'Closing and opening cover')
        const clipMoving = gltf.animations.find(c => c.name === 'Moving needle')
        const clipIdle = gltf.animations.find(c => c.name === 'Needle idle')

        const actionCover = clipCover ? mixer.clipAction(clipCover) : null
        const actionMoving = clipMoving ? mixer.clipAction(clipMoving) : null
        const actionIdle = clipIdle ? mixer.clipAction(clipIdle) : null

        if (actionIdle) {
            actionIdle.setLoop(THREE.LoopRepeat, Infinity)
            actionIdle.clampWhenFinished = false
            actionIdle.enabled = true
        }

        let spinning = false

        function playCoverOnce() {
            if (!actionCover) return
            try { if (actionMoving) { actionMoving.stop(); actionMoving.reset(); actionMoving.enabled = false; } } catch (e) { }
            try { if (actionIdle) { actionIdle.stop(); actionIdle.reset(); actionIdle.enabled = false; } } catch (e) { }

            try { actionCover.stop() } catch (e) { }
            actionCover.reset()
            actionCover.setLoop(THREE.LoopOnce, 0)
            actionCover.clampWhenFinished = true
            actionCover.enabled = true
            actionCover.setEffectiveWeight(1)
            actionCover.timeScale = 1
            actionCover.play()
        }

        function playMovingOnce(forward = true) {
            if (!actionMoving) return
            if (actionIdle && actionIdle.isRunning()) {
                actionIdle.stop()
            }
            try { if (actionCover) { actionCover.stop(); actionCover.reset(); actionCover.enabled = false; } } catch (e) { }

            try { actionMoving.stop() } catch (e) { }
            actionMoving.reset()
            actionMoving.setLoop(THREE.LoopOnce, 0)
            actionMoving.clampWhenFinished = true
            actionMoving.enabled = true
            actionMoving.setEffectiveWeight(1)
            if (forward) {
                actionMoving.timeScale = 1
                actionMoving.play()
            } else {
                actionMoving.time = actionMoving.getClip().duration
                actionMoving.timeScale = -1
                actionMoving.play()
            }
        }

        mixer.addEventListener('finished', (e) => {
            if (e.action === actionMoving) {
                if (actionMoving.timeScale > 0) {
                    if (actionIdle) {
                        actionIdle.reset()
                        actionIdle.enabled = true
                        actionIdle.timeScale = 1
                        actionIdle.play()
                    }
                    spinning = true
                } else {
                    spinning = false
                }
            }
        })

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

            const coverNames = new Set(['Cube007'])
            const pickupNames = new Set(['PickupBaseAttachment', 'VinylDisk'])

            if (coverNames.has(name)) {
                playCoverOnce()
                return
            }

            if (pickupNames.has(name)) {
                if (!spinning) {
                    playMovingOnce(true)
                } else {
                    if (actionIdle && actionIdle.isRunning()) actionIdle.stop()
                    playMovingOnce(false)
                }
            }
        }

        if (threeCanvas) {
            threeCanvas.addEventListener('pointerdown', onPointerDownForAnimation, { passive: true })
        }

        try {
            const bbox = new THREE.Box3().setFromObject(gltf.scene);
            const modelCenter = new THREE.Vector3();
            bbox.getCenter(modelCenter);

            controls.target.copy(modelCenter);

            const sphere = new THREE.Sphere();
            bbox.getBoundingSphere(sphere);
            const radius = sphere.radius || Math.max(bbox.getSize(new THREE.Vector3()).length() * 0.5, 1);

            const distance = radius * 1.8; 
            const direction = new THREE.Vector3(85, 45, 1).normalize();
            const initialYawDeg = 0; 
            if (initialYawDeg !== 0) {
                const yawRad = THREE.MathUtils.degToRad(initialYawDeg);
                const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawRad);
                direction.applyQuaternion(q);
            }

            camara.position.copy(modelCenter).add(direction.multiplyScalar(distance));

            camara.near = Math.max(0.01, distance * 0.001);
            camara.far = Math.max(1000, distance * 20);
            camara.updateProjectionMatrix();

            camara.lookAt(modelCenter);
            controls.update();

            controls.minDistance = Math.max(distance * 0.25, 0.05);
            controls.maxDistance = distance * 8;

        } catch (err) {
            console.warn('Could not compute model center or reposition camera:', err);
        }
    }
)

let delta = 0;
let relogio = new THREE.Clock();
let latencia_minima = 1 / 60;
animar()
function animar() {
    requestAnimationFrame(animar);
    delta += relogio.getDelta();

    if (delta < latencia_minima) return;

    cena.traverse((child) => {
        if (child instanceof THREE.PointLightHelper || child instanceof THREE.SpotLightHelper || child instanceof THREE.DirectionalLightHelper) {
            child.update();
        }
    });

    try {
        if (gltfMixer) {
            gltfMixer.update(delta);
        }
    } catch (e) {
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