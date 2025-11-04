import * as THREE from "three"
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// Criar cena do threeJS
let cena = new THREE.Scene()
window.cena = cena

// Criar Renderer
const threeCanvas = document.getElementById('three-canvas');

// Crie o renderer com antialias e pixel ratio do dispositivo para bordas mais nítidas
let renderer = new THREE.WebGLRenderer({canvas: threeCanvas, antialias: true})
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

        // Ativar sombras em todas as malhas do modelo carregado para que projetem e recebam sombras
        gltf.scene.traverse((obj) => {
            if (obj.isMesh) {
                obj.castShadow = true
                obj.receiveShadow = true
                // Garantir que o material seja atualizado se necessário
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => { 
                        if (m) {
                            if (m.opacity < 1 || m.alphaMode === 'BLEND' || m.transmission > 0) {
                                m.transparent = true;
                                m.depthWrite = false;
                            }
                            m.needsUpdate = true;
                        }
                    })
                } else if (obj.material) {
                    // Corrigir transparência para materiais que devem ser translúcidos
                    if (obj.material.opacity < 1 || obj.material.alphaMode === 'BLEND' || obj.material.transmission > 0) {
                        obj.material.transparent = true;
                        obj.material.depthWrite = false;
                    }
                    obj.material.needsUpdate = true
                }
            }
        })

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

            console.log('Camera repositioned to:', camara.position, 'radius:', radius, 'distance:', distance);
        } catch (err) {
            console.warn('Could not compute model center or reposition camera:', err);
        }
    }
)

// Renderizar/Animar
{
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

        renderer.render(cena, camara)

        delta = delta % latencia_minima;
    }
}



document.addEventListener('DOMContentLoaded', function() {
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

    leftArrow.addEventListener('click', function() {
        currentIndex = (currentIndex > 0) ? currentIndex - 1 : swipeItems.length - 1;
        showImage(currentIndex);
    });

    rightArrow.addEventListener('click', function() {
        currentIndex = (currentIndex < swipeItems.length - 1) ? currentIndex + 1 : 0;
        showImage(currentIndex);
    });

});