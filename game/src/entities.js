// The things that move and the shapes they share: the player (on foot), vehicles (built from
// boxes, one material per spec colour), pedestrians, traffic cars and the Bay Patrol cruisers.
// Vehicles and people are simple Groups of Meshes, so no loader or asset is needed.

import * as THREE from '../vendor/three.js';
import { VEHICLE_SPECS } from './config.js';

function box(w, h, d, color, material) {
  const mat = material ?? new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

const glassMat = new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.1, metalness: 0.6 });
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3040 });

/** A car-shaped Group. `kind` keys VEHICLE_SPECS for colour and proportions. */
export function createVehicle(kind) {
  const spec = VEHICLE_SPECS[kind] ?? VEHICLE_SPECS.sedan;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.35, metalness: 0.55 });
  const isTruck = kind === 'truck';
  const isPolice = kind === 'police';
  const length = isTruck ? 5.2 : 4.2;
  const width = isTruck ? 2.2 : 1.9;
  const body = box(width, isTruck ? 1.4 : 0.8, length, spec.color, bodyMat);
  body.position.y = 0.8;
  group.add(body);
  const cabin = box(width * 0.85, isTruck ? 1.0 : 0.7, length * 0.45, spec.color, bodyMat);
  cabin.position.set(0, isTruck ? 2.0 : 1.4, isTruck ? 0.6 : -0.3);
  group.add(cabin);
  const glass = box(width * 0.86, 0.4, length * 0.4, 0xffffff, glassMat);
  glass.position.set(0, isTruck ? 2.1 : 1.45, isTruck ? 0.6 : -0.3);
  group.add(glass);
  for (const [x, z] of [[-width / 2 + 0.3, length / 2 - 0.3], [width / 2 - 0.3, length / 2 - 0.3]]) {
    const head = box(0.4, 0.2, 0.1, 0xffffff, headMat);
    head.position.set(x, 0.85, length / 2 + 0.01);
    group.add(head);
    const tail = box(0.4, 0.2, 0.1, 0xffffff, tailMat);
    tail.position.set(x, 0.85, -length / 2 - 0.01);
    group.add(tail);
  }
  for (const [x, z] of [[-width / 2 + 0.1, length / 2 - 0.6], [width / 2 - 0.1, length / 2 - 0.6], [-width / 2 + 0.1, -length / 2 + 0.6], [width / 2 - 0.1, -length / 2 + 0.6]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.42, z);
    group.add(wheel);
  }
  if (isPolice) {
    const light = box(0.6, 0.25, 0.3, 0xffffff, new THREE.MeshBasicMaterial({ color: 0xff2244 }));
    light.position.set(0, 2.55, 0.6);
    group.add(light);
    const light2 = box(0.6, 0.25, 0.3, 0xffffff, new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    light2.position.set(0.65, 2.55, 0.6);
    group.add(light2);
    const stripe = box(width + 0.02, 0.25, length * 0.7, 0xffffff, new THREE.MeshBasicMaterial({ color: 0xf4f4f4 }));
    stripe.position.set(0, 1.0, 0);
    group.add(stripe);
  }
  group.userData = { kind, spec, length, width };
  return group;
}

/** The player: a capsule-ish figure with a jacket colour and a head. */
export function createPlayer() {
  const group = new THREE.Group();
  const legs = box(0.5, 0.9, 0.3, 0x1a1a26);
  legs.position.y = 0.45;
  group.add(legs);
  const torso = box(0.6, 0.7, 0.35, 0xd4463a);
  torso.position.y = 1.25;
  group.add(torso);
  const head = box(0.35, 0.35, 0.3, 0xe0b088);
  head.position.y = 1.8;
  group.add(head);
  const armL = box(0.15, 0.6, 0.15, 0x1a1a26);
  armL.position.set(-0.38, 1.25, 0);
  group.add(armL);
  const armR = box(0.15, 0.6, 0.15, 0x1a1a26);
  armR.position.set(0.38, 1.25, 0);
  group.add(armR);
  return group;
}

/** A pedestrian figure; each carries its shirt colour for variety. */
export function createPedestrian(shirt) {
  const group = new THREE.Group();
  const legs = box(0.4, 0.8, 0.22, 0x222232);
  legs.position.y = 0.4;
  group.add(legs);
  const torso = box(0.5, 0.6, 0.28, shirt);
  torso.position.y = 1.1;
  group.add(torso);
  const head = box(0.28, 0.28, 0.24, 0xd9a878);
  head.position.y = 1.55;
  group.add(head);
  return group;
}

const SHIRTS = [0xd4463a, 0x3a7bd4, 0x3ad46a, 0xf0c030, 0x9b3ad4, 0xffffff, 0xff7a3a];

export { SHIRTS };
