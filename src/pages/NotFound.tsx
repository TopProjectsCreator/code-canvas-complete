import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import * as THREE from "three";
import { CSS3DRenderer, CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";

const NotFound = () => {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const euler = new THREE.Euler(0, 0, 0, "YXZ");

    const wallSize = 1000;
    const halfSize = wallSize / 2;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      1,
      5000
    );
    camera.position.set(0, 0, 300);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    container.appendChild(renderer.domElement);

    const cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(container.clientWidth, container.clientHeight);
    cssRenderer.domElement.style.position = "absolute";
    cssRenderer.domElement.style.top = "0";
    cssRenderer.domElement.style.left = "0";
    container.appendChild(cssRenderer.domElement);

    const wallStyle = `
      width: 600px; height: 400px;
      background: rgba(15, 20, 25, 0.85);
      border: 2px solid hsl(238 83% 60%);
      box-shadow: 0 0 40px hsl(238 83% 60% / 0.4);
      color: #fff; font-family: 'Inter', sans-serif;
      padding: 40px; box-sizing: border-box;
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; text-align: center; gap: 16px;
      backdrop-filter: blur(8px);
    `;
    const h1Style = `font-size: 64px; font-weight: 800; margin: 0; color: hsl(238 83% 70%); letter-spacing: 4px;`;
    const pStyle = `font-size: 18px; opacity: 0.85; margin: 0;`;
    const btnStyle = `
      display: inline-block; padding: 12px 24px; margin: 6px;
      background: hsl(238 83% 60%); color: #fff; text-decoration: none;
      border-radius: 6px; font-weight: 600; border: none; cursor: pointer;
      font-family: inherit; font-size: 14px; transition: all 0.2s;
    `;
    const linkStyle = `display: block; padding: 10px; margin: 4px 0; color: hsl(238 83% 70%); text-decoration: none; border-bottom: 1px solid hsl(238 83% 60% / 0.3); font-family: 'IBM Plex Mono', monospace;`;

    const createWall = (side: string, x: number, y: number, z: number, ry: number) => {
      const div = document.createElement("div");
      div.setAttribute("style", wallStyle);

      if (side === "front") {
        div.innerHTML = `
          <h1 style="${h1Style}">404</h1>
          <p style="${pStyle}">This page doesn't exist at <strong>${location.pathname}</strong></p>
          <div>
            <a href="/landing" style="${btnStyle}">/landing</a>
            <a href="/editor" style="${btnStyle}">/editor</a>
          </div>
          <p style="${pStyle}; font-size:13px; opacity:0.6; margin-top:20px;">WASD to move • Click + drag to look around</p>
        `;
      } else if (side === "right") {
        div.innerHTML = `
          <h1 style="${h1Style}">ACTIVITY</h1>
          <p style="${pStyle}">Most accessed canvases</p>
          <div style="font-size: 20px; color: hsl(238 83% 70%); line-height: 2;">
            • Project Dashboard<br/>• Client Canvas
          </div>
        `;
      } else if (side === "back") {
        div.innerHTML = `
          <h1 style="${h1Style}">DOCS</h1>
          <a href="/docs" style="${linkStyle}">/docs</a>
          <a href="/docs/features--index" style="${linkStyle}">/docs/features--index</a>
          <a href="/docs/features--getting-started" style="${linkStyle}">/docs/features--getting-started</a>
        `;
      } else if (side === "left") {
        div.innerHTML = `
          <h1 style="${h1Style}">HELP</h1>
          <p style="${pStyle}">Found something broken?</p>
          <button style="${btnStyle}" onclick="window.location.href='/editor'">Open Editor</button>
        `;
      }

      const object = new CSS3DObject(div);
      object.position.set(x, y, z);
      object.rotation.y = ry;
      scene.add(object);
    };

    createWall("front", 0, 0, -halfSize, 0);
    createWall("back", 0, 0, halfSize, Math.PI);
    createWall("left", -halfSize, 0, 0, Math.PI / 2);
    createWall("right", halfSize, 0, 0, -Math.PI / 2);

    const floorGeo = new THREE.PlaneGeometry(wallSize, wallSize);
    const floorMat = new THREE.MeshPhongMaterial({ color: 0x050505, shininess: 100 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -halfSize;
    scene.add(floor);

    const light = new THREE.PointLight(0x6366f1, 1, 2000);
    light.position.set(0, 400, 0);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyW" || e.code === "ArrowUp") moveForward = true;
      if (e.code === "KeyS" || e.code === "ArrowDown") moveBackward = true;
      if (e.code === "KeyA" || e.code === "ArrowLeft") moveLeft = true;
      if (e.code === "KeyD" || e.code === "ArrowRight") moveRight = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "KeyW" || e.code === "ArrowUp") moveForward = false;
      if (e.code === "KeyS" || e.code === "ArrowDown") moveBackward = false;
      if (e.code === "KeyA" || e.code === "ArrowLeft") moveLeft = false;
      if (e.code === "KeyD" || e.code === "ArrowRight") moveRight = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (e.buttons === 1) {
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= e.movementX * 0.003;
        euler.x -= e.movementY * 0.003;
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    container.addEventListener("mousemove", onMouseMove);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const delta = 0.1;
      velocity.x -= velocity.x * 5.0 * delta;
      velocity.z -= velocity.z * 5.0 * delta;
      direction.z = Number(moveForward) - Number(moveBackward);
      direction.x = Number(moveRight) - Number(moveLeft);
      direction.normalize();
      const camY = euler.y;
      if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
      if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;
      camera.position.x += (velocity.x * Math.cos(camY) - velocity.z * Math.sin(camY)) * delta;
      camera.position.z += (velocity.x * Math.sin(camY) + velocity.z * Math.cos(camY)) * delta;
      const boundary = halfSize - 100;
      camera.position.x = Math.max(-boundary, Math.min(boundary, camera.position.x));
      camera.position.z = Math.max(-boundary, Math.min(boundary, camera.position.z));
      renderer.render(scene, camera);
      cssRenderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      cssRenderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      container.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      if (cssRenderer.domElement.parentNode) cssRenderer.domElement.parentNode.removeChild(cssRenderer.domElement);
    };
  }, [location.pathname]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-background overflow-hidden cursor-grab active:cursor-grabbing"
    />
  );
};

export default NotFound;
