"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  EXPERIENCE_CATEGORY_META,
  getExperienceRelationLabel,
  humanizeExperienceSubtype,
} from "../../lib/experienceOntology";
import { formatNodeLabel } from "../../lib/displayText";
import {
  worldEdges,
  worldNodes,
  type WorldEdge,
  type WorldNode,
} from "./graphData";
import {
  loadOrbLayout,
  saveOrbLayout,
  type OrbPosition,
} from "./orbLayoutPersistence";
import styles from "./YouView.module.css";

const INITIAL_CAMERA_DESKTOP = new THREE.Vector3(0, 0.12, 10.25);
const INITIAL_CAMERA_MOBILE = new THREE.Vector3(0, 0.1, 19);
const CONNECTION_SEGMENTS = 28;
const WORLD_NODE_BY_KEY = new Map(worldNodes.map((node) => [node.key, node]));

type RenderedConnection = {
  edge: (typeof worldEdges)[number];
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  curve: THREE.QuadraticBezierCurve3;
  point: THREE.Vector3;
  baseOpacity: number;
};

function worldCategoryLabel(node: (typeof worldNodes)[number]) {
  return node.category === "self"
    ? "You"
    : EXPERIENCE_CATEGORY_META[node.category].label;
}

function seededRandom(seedText: string) {
  let seed = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }

  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createOrbTexture(node: WorldNode) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const [light, mid, dark] = node.palette;
  const base = context.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, light);
  base.addColorStop(0.48, mid);
  base.addColorStop(1, dark);
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const random = seededRandom(node.key);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < image.data.length; index += 4) {
    const grain = (random() - 0.5) * 17;
    image.data[index] = Math.max(0, Math.min(255, image.data[index] + grain));
    image.data[index + 1] = Math.max(
      0,
      Math.min(255, image.data[index + 1] + grain),
    );
    image.data[index + 2] = Math.max(
      0,
      Math.min(255, image.data[index + 2] + grain),
    );
  }
  context.putImageData(image, 0, 0);

  context.save();
  context.globalAlpha = node.certainty === "hypothesis" ? 0.2 : 0.12;
  context.strokeStyle = light;
  context.lineWidth = 2;
  for (let line = 0; line < 6; line += 1) {
    const y = 26 + line * 15 + random() * 8;
    context.beginPath();
    context.moveTo(-20, y);
    context.bezierCurveTo(70, y - 16, 170, y + 17, 280, y - 3);
    context.stroke();
  }
  context.restore();

  const glow = context.createRadialGradient(76, 24, 1, 76, 24, 66);
  glow.addColorStop(0, "rgba(255,255,255,0.72)");
  glow.addColorStop(0.28, "rgba(255,255,255,0.18)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function connectionOpacity(edge: WorldEdge) {
  if (edge.role === "root") return 0.54;
  return edge.certainty === "fact" ? 0.44 : 0.35;
}

function createConnection(
  from: THREE.Vector3,
  to: THREE.Vector3,
  edge: WorldEdge,
) {
  const midpoint = from.clone().lerp(to, 0.5);
  midpoint.z +=
    (edge.role === "root" ? 0.2 : 0.28) + from.distanceTo(to) * 0.05;
  const curve = new THREE.QuadraticBezierCurve3(from, midpoint, to);
  const geometry = new THREE.BufferGeometry().setFromPoints(
    curve.getPoints(CONNECTION_SEGMENTS),
  );
  const material = new THREE.LineBasicMaterial({
    color:
      edge.role === "root"
        ? 0x6f7070
        : edge.certainty === "fact"
          ? 0x7f7972
          : 0x969088,
    transparent: true,
    opacity: connectionOpacity(edge),
    depthWrite: false,
  });
  return {
    line: new THREE.Line(geometry, material),
    curve,
    point: new THREE.Vector3(),
  };
}

function updateConnectionGeometry(
  connection: RenderedConnection,
  from: THREE.Vector3,
  to: THREE.Vector3,
) {
  connection.curve.v0.copy(from);
  connection.curve.v1.copy(from).lerp(to, 0.5);
  connection.curve.v1.z +=
    (connection.edge.role === "root" ? 0.2 : 0.28) +
    from.distanceTo(to) * 0.05;
  connection.curve.v2.copy(to);

  const positions = connection.line.geometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;
  for (let index = 0; index <= CONNECTION_SEGMENTS; index += 1) {
    connection.curve.getPoint(index / CONNECTION_SEGMENTS, connection.point);
    positions.setXYZ(
      index,
      connection.point.x,
      connection.point.y,
      connection.point.z,
    );
  }

  positions.needsUpdate = true;
  connection.line.geometry.computeBoundingSphere();
}

function softenBoundary(value: number, limit: number) {
  const distance = Math.abs(value);
  if (distance <= limit) return value;

  const softenedOvershoot = Math.min(0.72, (distance - limit) * 0.24);
  return Math.sign(value) * (limit + softenedOvershoot);
}

export default function YouView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef(new Map<string, HTMLButtonElement>());
  const selectedKeyRef = useRef<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const selectedNode = useMemo(
    () => (selectedKey ? (WORLD_NODE_BY_KEY.get(selectedKey) ?? null) : null),
    [selectedKey],
  );
  const connectedItems = useMemo(() => {
    if (!selectedKey) return [];

    const items: Array<{
      node: (typeof worldNodes)[number];
      edge: (typeof worldEdges)[number];
      direction: "forward" | "reverse";
    }> = [];

    for (const edge of worldEdges) {
      const direction =
        edge.from === selectedKey
          ? "forward"
          : edge.to === selectedKey
            ? "reverse"
            : null;
      if (!direction) continue;

      const connectedKey = direction === "forward" ? edge.to : edge.from;
      const node = WORLD_NODE_BY_KEY.get(connectedKey);
      if (node) items.push({ node, edge, direction });
    }

    return items.sort(
      (first, second) =>
        second.edge.strength - first.edge.strength ||
        first.node.label.localeCompare(second.node.label),
    );
  }, [selectedKey]);

  useEffect(() => {
    selectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedKey(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const containerElement: HTMLDivElement = container;
    const canvasElement: HTMLCanvasElement = canvas;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvasElement,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      containerElement.dataset.webglFailed = "true";
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0xffffff, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const initialCamera =
      window.innerWidth < 640
        ? INITIAL_CAMERA_MOBILE
        : INITIAL_CAMERA_DESKTOP;
    camera.position.copy(initialCamera);

    const controls = new OrbitControls(camera, canvasElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.65;
    controls.panSpeed = 0.5;
    controls.minDistance = 5.8;
    controls.maxDistance = 24;
    controls.screenSpacePanning = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.touches.ONE = THREE.TOUCH.PAN;
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    controls.target.set(0, 0, 0);
    controls.update();

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb6aa9d, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
    keyLight.position.set(-4, 6, 7);
    scene.add(keyLight);
    const warmLight = new THREE.PointLight(0xffc7a2, 12, 18, 2);
    warmLight.position.set(4, -2, 5);
    scene.add(warmLight);
    const coolLight = new THREE.PointLight(0xb7e7f4, 8, 16, 2);
    coolLight.position.set(-5, 1, 3);
    scene.add(coolLight);

    const world = new THREE.Group();
    world.rotation.set(-0.08, -0.22, 0.025);
    world.position.y = 0.24;
    scene.add(world);

    let layoutStorage: Storage | null = null;
    try {
      layoutStorage = window.localStorage;
    } catch {
      // Browsers may disable storage. The world still works with authored
      // positions for that session.
    }
    const savedPositions = loadOrbLayout(
      layoutStorage,
      new Set(worldNodes.map((node) => node.key)),
    );

    const meshes = new Map<string, THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial>>();
    const textures: THREE.Texture[] = [];
    const baseOpacities = new Map<string, number>();

    for (const node of worldNodes) {
      const texture = createOrbTexture(node);
      if (texture) textures.push(texture);
      const geometry = new THREE.SphereGeometry(node.radius, 52, 38);
      const baseOpacity = node.certainty === "hypothesis" ? 0.88 : 1;
      const isSelf = node.category === "self";
      const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: texture,
        roughness: isSelf ? 0.13 : node.category === "pattern" ? 0.34 : 0.2,
        metalness: isSelf ? 0.1 : node.category === "condition" ? 0.16 : 0.04,
        clearcoat: 1,
        clearcoatRoughness: isSelf ? 0.09 : 0.16,
        iridescence: isSelf
          ? 0.68
          : node.certainty === "hypothesis"
            ? 0.32
            : 0.12,
        iridescenceIOR: isSelf ? 1.4 : 1.3,
        emissive: isSelf ? 0x65788b : 0x000000,
        emissiveIntensity: isSelf ? 0.1 : 0,
        transparent: true,
        opacity: baseOpacity,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...(savedPositions.get(node.key) ?? node.position));
      mesh.userData.nodeKey = node.key;
      world.add(mesh);
      meshes.set(node.key, mesh);
      baseOpacities.set(node.key, baseOpacity);

      if (node.category === "self" || node.category === "experience") {
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(
            node.radius * (node.category === "self" ? 1.2 : 1.14),
            40,
            28,
          ),
          new THREE.MeshBasicMaterial({
            color: node.category === "self" ? 0xb8cbd3 : 0xd79a72,
            transparent: true,
            opacity: node.category === "self" ? 0.11 : 0.055,
            side: THREE.BackSide,
            depthWrite: false,
          }),
        );
        mesh.add(halo);
      }
    }

    const edgeLines: RenderedConnection[] = [];

    for (const edge of worldEdges) {
      const from = meshes.get(edge.from);
      const to = meshes.get(edge.to);
      if (!from || !to) continue;
      const connection = createConnection(
        from.position.clone(),
        to.position.clone(),
        edge,
      );
      world.add(connection.line);
      edgeLines.push({
        edge,
        ...connection,
        baseOpacity: connectionOpacity(edge),
      });
    }

    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const pointerStart = new THREE.Vector2();
    const pointerCurrent = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    const dragPlaneNormal = new THREE.Vector3();
    const dragIntersection = new THREE.Vector3();
    const draggedWorldPosition = new THREE.Vector3();
    const dragOffset = new THREE.Vector3();
    const panRight = new THREE.Vector3();
    const panUp = new THREE.Vector3();
    const panOffset = new THREE.Vector3();
    let hoveredKey: string | null = null;
    let dragCandidateKey: string | null = null;
    let draggingKey: string | null = null;
    let activePointerId: number | null = null;
    let animationFrame = 0;
    let reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    function updatePointer(event: PointerEvent) {
      const rect = canvasElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    }

    function pickNode(event: PointerEvent) {
      updatePointer(event);
      const hit = raycaster.intersectObjects([...meshes.values()], false)[0];
      return hit?.object.userData.nodeKey as string | undefined;
    }

    function updateConnectedLines(nodeKey: string) {
      for (const connection of edgeLines) {
        if (
          connection.edge.from !== nodeKey &&
          connection.edge.to !== nodeKey
        ) {
          continue;
        }

        const from = meshes.get(connection.edge.from);
        const to = meshes.get(connection.edge.to);
        if (!from || !to) continue;
        updateConnectionGeometry(connection, from.position, to.position);
      }
    }

    function persistOrbPositions() {
      const positions = new Map<string, OrbPosition>();
      for (const [key, mesh] of meshes) {
        positions.set(key, [
          mesh.position.x,
          mesh.position.y,
          mesh.position.z,
        ]);
      }
      saveOrbLayout(layoutStorage, positions);
    }

    function onPointerMove(event: PointerEvent) {
      if (
        activePointerId !== null &&
        event.pointerId !== activePointerId
      ) {
        return;
      }

      if (dragCandidateKey) {
        event.preventDefault();
        event.stopImmediatePropagation();

        pointerCurrent.set(event.clientX, event.clientY);
        const movement = pointerStart.distanceTo(pointerCurrent);

        if (!draggingKey && movement > 4) {
          draggingKey = dragCandidateKey;
          selectedKeyRef.current = null;
          setSelectedKey(null);
        }

        if (draggingKey) {
          const mesh = meshes.get(draggingKey);
          updatePointer(event);

          if (mesh && raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
            draggedWorldPosition.copy(dragIntersection).add(dragOffset);
            world.worldToLocal(draggedWorldPosition);
            draggedWorldPosition.set(
              softenBoundary(draggedWorldPosition.x, 5.2),
              softenBoundary(draggedWorldPosition.y, 3.8),
              softenBoundary(draggedWorldPosition.z, 2.8),
            );
            mesh.position.copy(draggedWorldPosition);
            updateConnectedLines(draggingKey);
          }

          hoveredKey = draggingKey;
          canvasElement.style.cursor = "grabbing";
        }
        return;
      }

      const nextHovered = pickNode(event) ?? null;
      if (nextHovered !== hoveredKey) {
        hoveredKey = nextHovered;
        canvasElement.style.cursor = hoveredKey ? "move" : "grab";
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (activePointerId !== null) return;

      pointerStart.set(event.clientX, event.clientY);
      canvasElement.style.cursor = "grabbing";
      setHasInteracted(true);

      const isWorldGesture =
        event.button !== 0 ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey;
      const nodeKey = isWorldGesture ? null : (pickNode(event) ?? null);
      if (!nodeKey) return;

      const mesh = meshes.get(nodeKey);
      if (!mesh) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      activePointerId = event.pointerId;
      dragCandidateKey = nodeKey;
      controls.enabled = false;
      canvasElement.setPointerCapture(event.pointerId);

      mesh.getWorldPosition(draggedWorldPosition);
      camera.getWorldDirection(dragPlaneNormal);
      dragPlane.setFromNormalAndCoplanarPoint(
        dragPlaneNormal,
        draggedWorldPosition,
      );
      updatePointer(event);
      if (raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
        dragOffset.copy(draggedWorldPosition).sub(dragIntersection);
      } else {
        dragOffset.set(0, 0, 0);
      }
    }

    function onPointerUp(event: PointerEvent) {
      if (
        activePointerId !== null &&
        event.pointerId !== activePointerId
      ) {
        return;
      }

      pointerCurrent.set(event.clientX, event.clientY);
      const movement = pointerStart.distanceTo(pointerCurrent);

      if (dragCandidateKey) {
        event.preventDefault();
        event.stopImmediatePropagation();

        const movedOrb = draggingKey !== null;

        if (!draggingKey && movement <= 5) {
          selectedKeyRef.current = dragCandidateKey;
          setSelectedKey(dragCandidateKey);
        }

        if (canvasElement.hasPointerCapture(event.pointerId)) {
          canvasElement.releasePointerCapture(event.pointerId);
        }

        activePointerId = null;
        dragCandidateKey = null;
        draggingKey = null;
        controls.enabled = true;
        if (movedOrb) persistOrbPositions();
        hoveredKey = pickNode(event) ?? null;
        canvasElement.style.cursor = hoveredKey ? "move" : "grab";
        return;
      }

      canvasElement.style.cursor = hoveredKey ? "move" : "grab";
      if (movement <= 5) setSelectedKey(null);
    }

    function onPointerCancel(event: PointerEvent) {
      if (event.pointerId !== activePointerId) return;
      const movedOrb = draggingKey !== null;
      if (canvasElement.hasPointerCapture(event.pointerId)) {
        canvasElement.releasePointerCapture(event.pointerId);
      }
      activePointerId = null;
      dragCandidateKey = null;
      draggingKey = null;
      controls.enabled = true;
      if (movedOrb) persistOrbPositions();
      canvasElement.style.cursor = "grab";
    }

    function onWheel(event: WheelEvent) {
      setHasInteracted(true);

      // Browsers expose a trackpad pinch as a wheel event with ctrlKey set.
      // Leave those events to OrbitControls; ordinary two-finger movement pans.
      if (event.ctrlKey) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const deltaMultiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? containerElement.clientHeight
            : 1;
      const distance = camera.position.distanceTo(controls.target);
      const worldUnitsPerPixel =
        (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))) /
        Math.max(containerElement.clientHeight, 1);

      camera.updateMatrixWorld();
      panRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      panUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      panOffset
        .copy(panRight)
        .multiplyScalar(event.deltaX * deltaMultiplier * worldUnitsPerPixel)
        .addScaledVector(
          panUp,
          -event.deltaY * deltaMultiplier * worldUnitsPerPixel,
        );

      camera.position.add(panOffset);
      controls.target.add(panOffset);
      controls.update();
    }

    function onContextMenu(event: MouseEvent) {
      event.preventDefault();
    }

    function onPointerLeave() {
      if (activePointerId !== null) return;
      hoveredKey = null;
      canvasElement.style.cursor = "grab";
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionPreference = () => {
      reducedMotion = motionQuery.matches;
      controls.enableDamping = !reducedMotion;
    };
    motionQuery.addEventListener("change", onMotionPreference);

    canvasElement.addEventListener("pointermove", onPointerMove, true);
    canvasElement.addEventListener("pointerdown", onPointerDown, true);
    canvasElement.addEventListener("pointerup", onPointerUp, true);
    canvasElement.addEventListener("pointercancel", onPointerCancel, true);
    canvasElement.addEventListener("pointerleave", onPointerLeave);
    canvasElement.addEventListener("wheel", onWheel, {
      capture: true,
      passive: false,
    });
    canvasElement.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("pagehide", persistOrbPositions);

    const worldPosition = new THREE.Vector3();
    const labelPosition = new THREE.Vector3();
    const viewPosition = new THREE.Vector3();
    const scaleVector = new THREE.Vector3();
    const connectedKeys = new Set<string>();
    const verticalProjectionScale =
      1 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));

    function resize() {
      const { width, height } = containerElement.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(containerElement);
    resize();

    function render() {
      animationFrame = window.requestAnimationFrame(render);
      if (!reducedMotion) controls.update();
      camera.updateMatrixWorld();

      const selected = selectedKeyRef.current;
      connectedKeys.clear();
      if (selected) {
        connectedKeys.add(selected);
        connectedKeys.add("self");
        for (const edge of worldEdges) {
          if (edge.from === selected) connectedKeys.add(edge.to);
          if (edge.to === selected) connectedKeys.add(edge.from);
        }
      }

      for (const node of worldNodes) {
        const mesh = meshes.get(node.key);
        if (!mesh) continue;
        const isSelected = selected === node.key;
        const isHovered = hoveredKey === node.key;
        const isDragging = draggingKey === node.key;
        const targetScale = isDragging
          ? 1.14
          : isSelected
            ? 1.12
            : isHovered
              ? 1.07
              : 1;
        scaleVector.setScalar(targetScale);
        mesh.scale.lerp(scaleVector, reducedMotion ? 1 : 0.13);

        const baseOpacity = baseOpacities.get(node.key) ?? 1;
        const targetOpacity =
          !selected || connectedKeys.has(node.key) ? baseOpacity : 0.26;
        mesh.material.opacity = THREE.MathUtils.lerp(
          mesh.material.opacity,
          targetOpacity,
          reducedMotion ? 1 : 0.12,
        );

        const label = labelRefs.current.get(node.key);
        if (!label) continue;
        mesh.getWorldPosition(worldPosition);
        labelPosition.copy(worldPosition);
        labelPosition.project(camera);
        viewPosition.copy(worldPosition).applyMatrix4(camera.matrixWorldInverse);
        const depth = -viewPosition.z;
        const isBehind = labelPosition.z > 1 || depth <= 0;
        const x =
          (labelPosition.x * 0.5 + 0.5) * containerElement.clientWidth;
        const orbCenterY =
          (-labelPosition.y * 0.5 + 0.5) * containerElement.clientHeight;
        const distance = camera.position.distanceTo(worldPosition);
        const distanceScale = THREE.MathUtils.clamp(
          9.5 / distance,
          0.72,
          1.08,
        );
        const orbScale = THREE.MathUtils.clamp(
          THREE.MathUtils.mapLinear(node.radius, 0.34, 0.9, 0.82, 1.22),
          0.82,
          1.22,
        );
        const labelScale = THREE.MathUtils.clamp(
          distanceScale * orbScale,
          0.72,
          1.28,
        );
        const projectedRadius =
          depth > 0
            ? node.radius *
              mesh.scale.x *
              containerElement.clientHeight *
              verticalProjectionScale /
              depth
            : 0;
        const labelHalfHeight = node.category === "self" ? 15.5 : 13.5;
        const y =
          orbCenterY + projectedRadius + labelHalfHeight * labelScale + 6;
        const hideMinorOnMobile =
          containerElement.clientWidth < 620 && !node.major && !isSelected;
        const isMobile = containerElement.clientWidth < 620;
        const horizontalMargin = isMobile ? 68 : 92;
        const outsideSafeFrame =
          x < horizontalMargin ||
          x > containerElement.clientWidth - horizontalMargin ||
          y < 48 ||
          y > containerElement.clientHeight - (isMobile ? 104 : 72);
        const labelOpacity =
          isBehind || hideMinorOnMobile || outsideSafeFrame
            ? 0
            : !selected || connectedKeys.has(node.key)
              ? node.certainty === "hypothesis"
                ? 0.76
                : 0.9
              : 0.18;
        label.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${labelScale})`;
        label.style.opacity = String(labelOpacity);
        label.style.pointerEvents = labelOpacity > 0.4 ? "auto" : "none";
      }

      for (const { edge, line, baseOpacity } of edgeLines) {
        const touchesSelection =
          !selected || edge.from === selected || edge.to === selected;
        const targetOpacity = touchesSelection ? baseOpacity : 0.035;
        line.material.opacity = THREE.MathUtils.lerp(
          line.material.opacity,
          targetOpacity,
          reducedMotion ? 1 : 0.12,
        );
      }

      renderer.render(scene, camera);
    }
    render();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      motionQuery.removeEventListener("change", onMotionPreference);
      canvasElement.removeEventListener("pointermove", onPointerMove, true);
      canvasElement.removeEventListener("pointerdown", onPointerDown, true);
      canvasElement.removeEventListener("pointerup", onPointerUp, true);
      canvasElement.removeEventListener("pointercancel", onPointerCancel, true);
      canvasElement.removeEventListener("pointerleave", onPointerLeave);
      canvasElement.removeEventListener("wheel", onWheel, true);
      canvasElement.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("pagehide", persistOrbPositions);
      controls.dispose();
      for (const mesh of meshes.values()) {
        for (const child of mesh.children) {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              for (const material of child.material) material.dispose();
            } else {
              child.material.dispose();
            }
          }
        }
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      for (const { line } of edgeLines) {
        line.geometry.dispose();
        line.material.dispose();
      }
      for (const texture of textures) texture.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className={styles.world} ref={containerRef}>
      <div className={styles.atmosphere} aria-hidden="true" />
      <canvas
        className={styles.canvas}
        ref={canvasRef}
        aria-label="An interactive three-dimensional map of your memories"
      />

      <div className={styles.labels} aria-label="Memory graph nodes">
        {worldNodes.map((node) => (
          <button
            className={styles.nodeLabel}
            data-category={node.category}
            data-selected={selectedKey === node.key ? "true" : "false"}
            key={node.key}
            type="button"
            ref={(element) => {
              if (element) labelRefs.current.set(node.key, element);
              else labelRefs.current.delete(node.key);
            }}
            onClick={() => {
              setSelectedKey(node.key);
              setHasInteracted(true);
            }}
          >
            {formatNodeLabel(node.label)}
          </button>
        ))}
      </div>

      <p
        className={styles.gestureHint}
        data-hidden={hasInteracted ? "true" : "false"}
      >
        <span className={styles.desktopGestureHint}>
          drag an orb · drag empty space to turn · two-finger scroll to pan ·
          pinch to zoom
        </span>
        <span className={styles.mobileGestureHint}>
          drag an orb · drag space to pan · two fingers to turn or zoom
        </span>
      </p>

      <aside
        className={styles.inspector}
        data-open={selectedNode ? "true" : "false"}
        aria-hidden={!selectedNode}
        aria-live="polite"
      >
        {selectedNode ? (
          <>
            <button
              className={styles.closeButton}
              type="button"
              aria-label="Close memory detail"
              onClick={() => setSelectedKey(null)}
            >
              <span aria-hidden="true">×</span>
            </button>
            <div
              className={styles.inspectorOrb}
              aria-hidden="true"
              style={{
                background: `radial-gradient(circle at 34% 24%, ${selectedNode.palette[0]}, ${selectedNode.palette[1]} 48%, ${selectedNode.palette[2]} 100%)`,
              }}
            />
            <div className={styles.taxonomy}>
              <span>{worldCategoryLabel(selectedNode)}</span>
              <span aria-hidden="true">·</span>
              <span>{humanizeExperienceSubtype(selectedNode.subtype)}</span>
            </div>
            <h2>{formatNodeLabel(selectedNode.label)}</h2>
            <p className={styles.description}>{selectedNode.description}</p>
            <div className={styles.evidence}>
              <span>
                {selectedNode.category === "self"
                  ? "how this world grows"
                  : "from what you told sidequest"}
              </span>
              <p>{selectedNode.evidence}</p>
            </div>
            {connectedItems.length > 0 ? (
              <div className={styles.connections}>
                <div className={styles.connectionsHeading}>
                  <span className={styles.connectionsLabel}>in your world</span>
                  <span className={styles.connectionsCount}>
                    {connectedItems.length} direct
                  </span>
                </div>
                <div className={styles.connectionList}>
                  {connectedItems.map(({ node, edge, direction }) => (
                    <button
                      className={styles.connectionButton}
                      type="button"
                      key={`${edge.from}:${edge.relation}:${edge.to}`}
                      aria-label={`Open ${formatNodeLabel(node.label)}, ${getExperienceRelationLabel(edge.relation, direction)}`}
                      onClick={() => {
                        selectedKeyRef.current = node.key;
                        setSelectedKey(node.key);
                      }}
                    >
                      <span
                        className={styles.connectionOrb}
                        aria-hidden="true"
                        style={{
                          background: `radial-gradient(circle at 34% 24%, ${node.palette[0]}, ${node.palette[1]} 48%, ${node.palette[2]} 100%)`,
                        }}
                      />
                      <span className={styles.connectionCopy}>
                        <span className={styles.connectionName}>
                          {formatNodeLabel(node.label)}
                        </span>
                        <span className={styles.connectionMeta}>
                          {getExperienceRelationLabel(edge.relation, direction)} ·{" "}
                          {worldCategoryLabel(node)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </aside>

      <div className={styles.fallback} role="status">
        <p>Your world could not open in 3D on this device.</p>
      </div>
    </div>
  );
}
