import { PropCatalog } from '../render/PropCatalog';
import * as THREE from 'three';
import type { MaterialOverrides } from '../render/MaterialLibrary';
import { SURFACE_VARIATION_KEY, attachSurfaceAppearance } from '../render/SurfaceAppearance';
import { REVIEW_REVISION, REVIEW_WIDTH, REVIEW_HEIGHT, VISUAL_CASES } from './visualReviewCases';
import { ROOMS, TEMPLATE_BY_ID, isImplemented } from '../data';
import { Rng } from '../core/rng';
import { QUALITY_TIERS, type RoomInstance, type QualityTierId } from '../core/types';
import { generateLayout } from '../generators';
import { generateAdapter } from '../generators/AdapterGenerator';
import { paletteFor } from '../generators/presets';
import { type RoomLayout, VARIANTS } from '../generators/layout';
import { MaterialLibrary, SURFACES } from '../render/MaterialLibrary';
import { RoomBuilder, type BuiltRoom } from '../render/RoomBuilder';

if (!import.meta.env.DEV) throw new Error('Visual review is development-only.');
const canvas = document.querySelector<HTMLCanvasElement>('#review')!;
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x262a28);
scene.fog = new THREE.Fog(0x262a28, 12, 90);
scene.add(new THREE.HemisphereLight(0xe5e4d5, 0x6c665a, .32));
const camera = new THREE.PerspectiveCamera(72, 1, .05, 150);
const materials = new MaterialLibrary(); materials.configure(renderer);
const builder = new RoomBuilder(materials, { worldSeed: () => Number(seedInput.value) >>> 0 });
const roomSelect = document.querySelector<HTMLSelectElement>('#room')!;
const view = document.querySelector<HTMLSelectElement>('#view')!;
const tier = document.querySelector<HTMLSelectElement>('#tier')!;
const status = document.querySelector('#status')!;
const report = document.querySelector('#report')!;
let built: BuiltRoom | undefined, layout: RoomLayout, auditing = false;
const errors: string[] = [];
const params = new URLSearchParams(location.search);
const seedInput = document.querySelector<HTMLInputElement>('#seed')!;
const variantInput = document.querySelector<HTMLInputElement>('#variant')!;
const exposureInput = document.querySelector<HTMLInputElement>('#exposure')!;
const diagnostic = document.querySelector<HTMLSelectElement>('#diagnostic')!;
let generationMs = 0;
let measurement: object | null = null;
let measuring = false;
let customCamera=false;
const lightPreset=document.createElement('select');lightPreset.id='review-light';
for(const [id,label] of [['scene','部屋照明'],['white','白色素材照明'],['warm','暖色素材照明'],['raking','斜め素材照明']])lightPreset.add(new Option(label,id));
document.querySelector('header')!.append(lightPreset);
const lab=new THREE.Group();scene.add(lab);
const labLight=new THREE.DirectionalLight(0xffffff,3);labLight.position.set(4,8,8);scene.add(labLight);labLight.visible=false;
const labIds=['wallWhite','floorCarpetGrey','ceilingTile','doorWood','floorConcrete','floorTile','metal','floorLino','boxCardboard','plant','lightOff','water','doorMetal','carPaint','carGlass','rubber'] as const;
let labReady=false;
const mirrorCheck=document.createElement('input');mirrorCheck.type='checkbox';mirrorCheck.id='mirror-uv';const mirrorLabel=document.createElement('label');mirrorLabel.textContent='鏡像UV検査';mirrorLabel.append(mirrorCheck);document.querySelector('header')!.append(mirrorLabel);
function applyMirror(){for(const obj of lab.children){if(obj instanceof THREE.Mesh && obj.geometry.type==='PlaneGeometry'){const uv=obj.geometry.attributes.uv,p=obj.geometry.attributes.position;for(let i=0;i<uv.count;i++){const u=(p.getX(i)/1.7+.5)*2;uv.setX(i,mirrorCheck.checked?1-Math.abs(u-1):u);}uv.needsUpdate=true;}}}
mirrorCheck.onchange=()=>{applyMirror();render();};
function prepareLab() {
 if(labReady)return;labReady=true;
 labIds.forEach((id,i)=>{
  const g=new THREE.PlaneGeometry(1.7,1.7,2,1);const uv=g.getAttribute('uv');for(let j=0;j<uv.count;j++)uv.setXY(j,uv.getX(j)*2,uv.getY(j)*2);
  g.setAttribute('bakedLight',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(.15),3));attachSurfaceAppearance(g,42);
  const patch=new THREE.Mesh(g,materials.get(id));patch.position.set((i%4-1.5)*2.15,(1.5-Math.floor(i/4))*2.15,0);lab.add(patch);
  const sphereGeo=new THREE.SphereGeometry(.33,32,16);sphereGeo.setAttribute('bakedLight',new THREE.Float32BufferAttribute(new Float32Array(sphereGeo.attributes.position.count*3).fill(.15),3));attachSurfaceAppearance(sphereGeo,42);
  const ball=new THREE.Mesh(sphereGeo,materials.get(id));ball.position.copy(patch.position).add(new THREE.Vector3(.5,-.5,.4));lab.add(ball);
 });
}
lightPreset.onchange=()=>{customCamera=false;positionCamera();applyMirror();render();};

for (const input of [seedInput, variantInput, exposureInput]) {
  if (params.has(input.id)) input.value = params.get(input.id)!;
  input.onchange = () => { if (!auditing) show(); };
}
function propReport() {
  const models: Record<string, number> = {};
  built?.group.traverse(o => { if (o.userData.prop && o instanceof THREE.InstancedMesh) models[o.userData.prop] = (models[o.userData.prop] ?? 0) + o.count; });
  return { modelInstances: Object.fromEntries(Object.entries(models).map(([id,n])=>[id,n/(PropCatalog.shared.model(id)?.parts.length??1)])), modelPartInstances: models, errors: PropCatalog.shared.errors, vehicles: layout.boxes.filter(b=>b.vehicle?.body).length };
}
function configuration() {
  return { props: propReport(), surfaceRevision: SURFACE_VARIATION_KEY, surfaceEnvironment: document.querySelector<HTMLInputElement>('#surface-environment')?.checked ?? true, surfaceWear: document.querySelector<HTMLInputElement>('#surface-wear')?.checked ?? true, surfaceVariation: document.querySelector<HTMLInputElement>('#v03-variation')?.checked ?? true, revision: REVIEW_REVISION, room: roomSelect.value, seed: Number(seedInput.value) >>> 0,
    variant: Number(variantInput.value), view: view.value, quality: tier.value,
    doorsOpen: built ? [...built.doors.values()].some(d=>d.portal.open) : false,
    exposure: Number(exposureInput.value), diagnostic: diagnostic.value, time: 0, camera: {position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov:camera.fov},
    imagingPreset:'off', mirroredUV:mirrorCheck.checked, device:{platform:navigator.platform,cores:navigator.hardwareConcurrency}, materialIds: lightPreset.value==='scene'?[...new Set(layout.boxes.map(b=>b.mat))]:labIds, lighting:lightPreset.value,
    viewport: [REVIEW_WIDTH, REVIEW_HEIGHT], dpr: renderer.getPixelRatio(), userAgent: navigator.userAgent,
    generationMs, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    memoryCounts: {...renderer.info.memory}, measurement, referenceRooms: VISUAL_CASES };
}
function syncURL() {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries({room:roomSelect.value,view:view.value,tier:tier.value,seed:seedInput.value,variant:variantInput.value,exposure:exposureInput.value,diagnostic:diagnostic.value})) q.set(key,value);
  if(params.has('props'))q.set('props',params.get('props')!);
  history.replaceState(null,'',`?${q}`);
}
async function capture(stage: 'before' | 'after') {
  if (auditing || measuring) return;
  render();
  const image = canvas.toDataURL('image/png');
  const response = await fetch('/__visual-baseline', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage,image,metadata:configuration()})});
  document.querySelector('#capture')!.textContent = response.ok ? JSON.stringify(await response.json()) : await response.text();
}
document.querySelector<HTMLButtonElement>('#save-before')!.onclick=()=>{void capture('before');};
document.querySelector<HTMLButtonElement>('#save-after')!.onclick=()=>{void capture('after');};
document.querySelector<HTMLButtonElement>('#measure')!.onclick=async()=>{
  if(auditing || measuring)return;
  measuring=true;
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('header button,header input,header select').forEach(e=>e.disabled=true);
  const times:number[]=[], submit:number[]=[]; let last=performance.now();
  for(let i=0;i<130;i++){
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    const now=performance.now();const start=performance.now();render();const end=performance.now();
    if(i>=10){times.push(now-last);submit.push(end-start);}last=now;
  }
  const stats=(a:number[])=>{a.sort((x,y)=>x-y);return {median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a[a.length-1]};};
  measurement={conditions:{room:roomSelect.value,seed:Number(seedInput.value)>>>0,variant:Number(variantInput.value),view:view.value,quality:tier.value,exposure:Number(exposureInput.value),diagnostic:diagnostic.value},samples:120,frameIntervalMs:stats(times),cpuRenderSubmissionMs:stats(submit),gpuTimeMs:null,note:'Browser scheduling included; CPU submission is not GPU duration.'};
  measuring=false;
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('header button,header input,header select').forEach(e=>e.disabled=false);
  document.querySelector('#capture')!.textContent=JSON.stringify(configuration(),null,2);
};
renderer.debug.onShaderError = (gl, program, vs, fs) => errors.push([gl.getProgramInfoLog(program), gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs)].join('\n'));
for (const r of ROOMS) { const option = new Option(`${r.id} ${r.name}${isImplemented(r) ? '' : '（代替）'}`,r.id); roomSelect.add(option); }
for (const id of ['vestibule','stairs','ramp','elevatorCar']) roomSelect.add(new Option(`Adapter ${id}`, id));
roomSelect.value = params.get('room') ?? 'C02';
for (const [label, value] of [['車両','vehicle'], ['鉢植え','plant'], ['家具','furniture']]) view.add(new Option(label,value));
view.add(new Option('扉の摩耗','door'));view.add(new Option('床・水際','environment'));diagnostic.add(new Option('埃／湿気マスク','environment'));
diagnostic.add(new Option('摩耗マスク','wear'));
view.value = params.get('view') ?? 'entry'; tier.value = params.get('tier') ?? 'high'; diagnostic.value = params.get('diagnostic') ?? 'beauty';

function build(id: string, variant = 0): BuiltRoom {
  builder.setTier(QUALITY_TIERS[tier.value as QualityTierId]);
  const def = ROOMS.find((r) => r.id === id) ?? ROOMS[1];
  const fallback = !isImplemented(def);
  const template = TEMPLATE_BY_ID.get(fallback ? 'LargeRoom' : def.baseTemplate)!;
  const palette = paletteFor(def, template, fallback);
  layout = id.length > 3 ? generateAdapter({kind:id as 'vestibule' | 'stairs' | 'ramp' | 'elevatorCar',entryType:'door',entryWidth:1,direction:1,length:6,turn:0,palette}) : generateLayout({
    def, template, rng: new Rng(Number(seedInput.value) >>> 0), entry:null, exits:Math.max(2,def.minExits),
    variant, palette, allowHole:false, extraSockets:[], removedSockets:[], label:{text:def.name,sub:id},
  }, fallback);
  const node = {roomId:'review',seed:Number(seedInput.value)>>>0,definitionId:def.id,placement:{position:[0,0,0],yawQ:0},portals:layout.sockets.map((s) => ({
    portalId:s.id,socketId:s.id,type:s.type,isReturn:false,open:false,locked:false,seam:false,oneWay:false,closeDelaySec:4,projected:true,
  }))} as RoomInstance;
  return builder.build(node,layout);
}
function show(): void {
  if (built) builder.dispose(built);
  const start=performance.now();
  built = build(roomSelect.value, Math.max(0, Math.floor(Number(variantInput.value)||0))); generationMs=performance.now()-start; measurement=null; scene.add(built.group,built.doorGroup);
  positionCamera(); render();
  const current = built, reportAfterLoad = !auditing;
  const ids = [...new Set(layout.boxes.flatMap(b => b.kind ? PropCatalog.shared.candidates(b.kind).map(e=>e.id) : []))];
  void Promise.all(ids.map(id=>PropCatalog.shared.load(id))).then(()=>{if(built===current&&reportAfterLoad&&!auditing){render();document.querySelector('#report')!.textContent=JSON.stringify(propReport(),null,2);}});
  status.textContent = `${roomSelect.selectedOptions[0].text} | ${built.triangles.toLocaleString()} triangles | ${renderer.info.render.calls} calls | textures ${renderer.info.memory.textures} | cc0 ${materials.cc0Status.index} ${materials.cc0Status.materials}/${materials.cc0Status.sets} | 読込エラー ${materials.errors.length}`;
}
function positionCamera(): void {
  if(lightPreset.value!=='scene'){prepareLab();camera.position.set(0,0,8);camera.lookAt(0,0,0);return;}
  if(customCamera)return;
  const entry = layout.sockets.find((s) => s.type !== 'hole');
  const b = layout.bounds;
  const cx = (b.min[0]+b.max[0])/2, cz=(b.min[2]+b.max[2])/2;
  if (view.value === 'entry' && entry) {
    const inward = [[0,-1],[-1,0],[0,1],[1,0]][entry.dir];
    camera.position.set(entry.pos[0]+inward[0]*1.5,entry.pos[1]+1.6,entry.pos[2]+inward[1]*1.5);
    camera.lookAt(camera.position.x+inward[0]*6, camera.position.y-.05,camera.position.z+inward[1]*6);
  } else if (view.value === 'door' && entry) {
    const inward = [[0,-1],[-1,0],[0,1],[1,0]][entry.dir];
    camera.position.set(entry.pos[0]+inward[0]*1.7,entry.pos[1]+1.1,entry.pos[2]+inward[1]*1.7);
    camera.lookAt(entry.pos[0],entry.pos[1]+.9,entry.pos[2]);
  } else if (['vehicle','plant','furniture'].includes(view.value)) {
    const t=layout.boxes.find(b=>view.value==='vehicle'?b.vehicle?.body:view.value==='plant'?b.kind==='plant':!!b.kind&&['desk','table','chair','sofa','cabinet','shelf'].includes(b.kind));
    if(t){const x=(t.min[0]+t.max[0])/2,z=(t.min[2]+t.max[2])/2;const d=view.value==='vehicle'?4.5:2.2;
      const r=layout.footprint.find(r=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1)??layout.footprint[0];
      const dir=new THREE.Vector3((r.x0+r.x1)/2-x,0,(r.z0+r.z1)/2-z).normalize();if(dir.lengthSq()<.01)dir.set(.7,0,.7);
      camera.position.set(x+dir.x*d,view.value==='vehicle'?1.9:1.25,z+dir.z*d);camera.lookAt(x,t.min[1]+.65,z);
    }else{camera.position.set(cx,1.6,cz);camera.lookAt(cx+2,1.4,cz+4);}
  } else if (view.value === 'environment') {
    const r=layout.footprint[0];
    camera.position.set(r.x0+1.1,.85,r.z0+3.5);camera.lookAt(r.x0+.15,.18,r.z0+4.5);
  } else if (view.value === 'detail') {
    const wanted:Record<string,string>={C02:'wallWhite',C06:'columnConcrete',C13:'boxCardboard',C18:'floorTile',C20:'floorConcrete',U10:'furnitureLight',R01:'floorTile',R07:'plant'};
    const candidates=layout.boxes.filter(b=>b.mat===wanted[roomSelect.value]);
    const targetBox=candidates.find(b=>b.max[1]-b.min[1]>.4)??candidates[0];
    const r=layout.footprint[0];
    if(targetBox){
      const t=targetBox;const x=(t.min[0]+t.max[0])/2,z=(t.min[2]+t.max[2])/2;
      if(t.max[1]-t.min[1]<.3){
        const inward=entry?[[0,-1],[-1,0],[0,1],[1,0]][entry.dir]:[0,1];
        const tx=entry?entry.pos[0]+inward[0]*2:x,tz=entry?entry.pos[2]+inward[1]*2:z;
        camera.position.set(tx+.4,t.max[1]+1,tz+.4);camera.lookAt(tx,t.max[1],tz);
      }else{
        const toward=new THREE.Vector3((r.x0+r.x1)/2-x,0,(r.z0+r.z1)/2-z);if(toward.lengthSq()<.01)toward.set(0,0,1);toward.normalize();
        const distance=Math.min(2,Math.min(t.max[0]-t.min[0],t.max[2]-t.min[2])/2+.85);
        const y=Math.min(t.max[1]-.1,t.min[1]+.8);camera.position.set(x+toward.x*distance,y+.15,z+toward.z*distance);camera.lookAt(x,y,z);
      }
    }else{camera.position.set(cx,1.6,cz);camera.lookAt(cx+.5,0,cz+.5);}
  } else {
    const rect = layout.footprint[0];
    const x = rect ? (rect.x0+rect.x1)/2 : cx, z=rect?(rect.z0+rect.z1)/2:cz;
    camera.position.set(x,1.6,z);camera.lookAt(x+(view.value==='reverse'?-2:2),1.45,z+(view.value==='reverse'?-5:5));
  }
}
function render(): void {
  materials.setDiagnostic(diagnostic.value);
  const q=QUALITY_TIERS[tier.value as QualityTierId];
  renderer.toneMappingExposure=Number(exposureInput.value)||1.25;
  renderer.setPixelRatio(q.renderScale);
  renderer.setSize(REVIEW_WIDTH,REVIEW_HEIGHT,false);
  camera.aspect=REVIEW_WIDTH/REVIEW_HEIGHT;camera.updateProjectionMatrix();
  if (built) {
    built.group.updateMatrixWorld(true);
    const lights=[...built.lights].sort((a,b)=>a.position.distanceToSquared(camera.position)-b.position.distanceToSquared(camera.position));
    lights.forEach((l,i)=>l.visible=i<q.maxLights);
  }
  const materialLab=lightPreset.value!=='scene';lab.visible=materialLab;labLight.visible=materialLab;
  if(built){built.group.visible=!materialLab;built.doorGroup.visible=!materialLab;}
  scene.fog=materialLab?null:new THREE.Fog(0x262a28,12,90);
  labLight.color.set(lightPreset.value==='warm'?0xffbd80:0xffffff);
  labLight.position.set(lightPreset.value==='raking'?8:3,lightPreset.value==='raking'?0:5,lightPreset.value==='raking'?1:8);
  renderer.render(scene,camera);
  if(!auditing)syncURL();
}
diagnostic.onchange=()=>{measurement=null;render();};
roomSelect.onchange=()=>{customCamera=false;if(!auditing)show();};view.onchange=()=>{customCamera=false;measurement=null;positionCamera();render();};tier.onchange=()=>{builder.setTier(QUALITY_TIERS[tier.value as QualityTierId]);show();};window.onresize=render;
document.querySelector<HTMLButtonElement>('#doors')!.onclick=()=>{if(!built)return;for(const d of built.doors.values()){d.portal.open=!d.portal.open;d.pivot.rotation.y=d.portal.open?-Math.PI*.475:0;}render();};

async function audit(): Promise<void> {
  if(auditing || measuring)return;
  const saved={room:roomSelect.value,view:view.value,tier:tier.value,diagnostic:diagnostic.value};
  diagnostic.value='beauty';
  auditing=true;
  errors.length=0;
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('header button,header input,header select').forEach(e=>e.disabled=true);
  const rows: {id:string;variant:number;triangles:number;materials:number}[]=[];
  const failures:string[]=[];
  const before=renderer.info.memory.geometries;
  const ids=[...ROOMS.map((r)=>r.id),'vestibule','stairs','ramp','elevatorCar'];
  for(const id of ids){
    for(const variant of [0, Math.min(3,(VARIANTS[ROOMS.find(r=>r.id===id)?.generator??'']??1)-1)]) {
      try {
        if(built)builder.dispose(built);
        built=build(id,variant);scene.add(built.group,built.doorGroup);positionCamera();
        const used=new Set<string>();
        built.group.traverse(o=>{
          if(!(o instanceof THREE.Mesh))return;
          const attr=o.geometry.getAttribute('position');
          if(!Array.from(attr.array).every(Number.isFinite))throw new Error('Non-finite geometry');
          for(const key of ['uv','normal','bakedLight']){const a=o.geometry.getAttribute(key);if(a&&!Array.from(a.array).every(Number.isFinite))throw new Error(`Non-finite ${key}`);}
          const ms=Array.isArray(o.material)?o.material:[o.material];
          for(const m of ms){
            if(!(m instanceof THREE.MeshStandardMaterial))throw new Error('Non-PBR material');
            if(!m.map)throw new Error(`Missing texture ${m.name}`);
            if(!(m.map.image as {width?:number})?.width)throw new Error(`Unloaded texture ${m.name}`);
            used.add(m.name);
          }
        });
        const collision=layout.boxes.filter(b=>b.solid).length;
        if(built.colliders.length!==collision)throw new Error('Collision count changed');
        for(const q of ['low','mid','high']) {tier.value=q;render();}
        rows.push({id,variant,triangles:built.triangles,materials:used.size});
      }catch(e){failures.push(`${id}/${variant}: ${String(e)}`);}
    }
    status.textContent=`検査中 ${id} / ${ids.length} 定義`;
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  }
  // Compile every material, including materials not reached by today's definitions.
  for(const id of Object.keys(SURFACES) as (keyof typeof SURFACES)[]){
    const m=materials.get(id);if(!(m.map?.image as {width?:number})?.width)failures.push(`texture ${id}`);
    const g=new THREE.SphereGeometry(.3,12,8);
    const mesh=new THREE.Mesh(g,m);mesh.position.copy(camera.position).add(new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion));
    scene.add(mesh);renderer.render(scene,camera);mesh.removeFromParent();g.dispose();
  }
  if(built){builder.dispose(built);built=undefined;}renderer.render(scene,camera);
  const result={seed:Number(seedInput.value)>>>0,revision:REVIEW_REVISION,definitions:ids.length,roomDefinitions:ROOMS.length,implementedDefinitions:ROOMS.filter(isImplemented).length,variants:rows.length,qualityLevels:3,materials:Object.keys(SURFACES).length,failures,shaderErrors:errors,textureErrors:materials.errors,geometriesBefore:before,geometriesAfterDispose:renderer.info.memory.geometries,maxTriangles:Math.max(...rows.map(r=>r.triangles)),rows};
  report.textContent=JSON.stringify(result,null,2);
  const a=document.querySelector<HTMLAnchorElement>('#download')!;
  if(a.href.startsWith('blob:'))URL.revokeObjectURL(a.href);
  a.href=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));a.download='visual-audit.json';a.hidden=false;
  auditing=false;roomSelect.value=saved.room;view.value=saved.view;tier.value=saved.tier;diagnostic.value=saved.diagnostic;show();
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('header button,header input,header select').forEach(e=>e.disabled=false);
  status.textContent=`検査終了: ${rows.length} ケース、失敗 ${failures.length}、shader ${errors.length}、texture ${materials.errors.length}`;
}
document.querySelector<HTMLButtonElement>('#audit')!.onclick=()=>{void audit();};
await Promise.all([materials.ready, PropCatalog.shared.preload()]);
installSurfaceReview(materials,renderer,render);
show();

/** Appearance diagnostics and isolated material-program compatibility checks. */
function installSurfaceReview(materials: MaterialLibrary, renderer: THREE.WebGLRenderer, render: () => void): void {
  const header=document.querySelector('header')!;
  const objectAudit=document.createElement('button');objectAudit.id='object-audit';objectAudit.textContent='オブジェクト検査';header.append(objectAudit);
  objectAudit.onclick=async()=>{
    if(auditing)return;auditing=true;objectAudit.disabled=true;errors.length=0;
    const rows:object[]=[];
    try {
      await Promise.all(['metal_office_desk','pachira_aquatica_01','dining_table'].map(id=>PropCatalog.shared.load(id)));
      for(const [id,v] of [['U06','plant'],['U14','furniture'],['U16','vehicle'],['R07','plant'],['E17','furniture']])for(const q of ['low','mid','high']){
        roomSelect.value=id;view.value=v;tier.value=q;customCamera=false;show();
        renderer.compile(scene,camera);render();
        rows.push({room:id,quality:q,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,colliders:built?.colliders.length,...propReport()});
        await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      }
      const result={objectRevision:1,seed:Number(seedInput.value),rows,shaderErrors:[...errors],textureErrors:[...materials.errors],propErrors:[...PropCatalog.shared.errors]};
      const response=await fetch('/__visual-baseline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage:'after',image:canvas.toDataURL('image/png'),metadata:result})});
      document.querySelector('#capture')!.textContent=JSON.stringify(await response.json());
      report.textContent=JSON.stringify(result,null,2);
    } finally {
      auditing=false;objectAudit.disabled=false;
      syncURL();
    }
  };

  const label=document.createElement('label');label.textContent='反復抑制';
  const toggle=document.createElement('input');toggle.type='checkbox';toggle.id='v03-variation';toggle.checked=true;
  label.append(toggle);header.append(label);
  toggle.onchange=()=>{materials.setSurfaceVariation(toggle.checked);measurement=null;render();};
  const wearLabel=document.createElement('label');wearLabel.textContent='局所摩耗';
  const wearToggle=document.createElement('input');wearToggle.type='checkbox';wearToggle.id='surface-wear';wearToggle.checked=true;
  wearLabel.append(wearToggle);header.append(wearLabel);
  wearToggle.onchange=()=>{materials.setSurfaceWear(wearToggle.checked);measurement=null;render();};
  
  const envLabel=document.createElement('label');envLabel.textContent='埃・湿気';
  const envToggle=document.createElement('input');envToggle.type='checkbox';envToggle.id='surface-environment';envToggle.checked=true;envLabel.append(envToggle);header.append(envLabel);
  envToggle.onchange=()=>{materials.setSurfaceEnvironment(envToggle.checked);measurement=null;render();};
  const button=document.createElement('button');button.id='v03-compile';button.textContent='表面素材互換検査';header.append(button);
  const output=document.createElement('pre');output.id='v03-result';document.body.append(output);
  button.onclick=()=>{
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.z=3;
    const g=new THREE.BoxGeometry(1,1,1);
    g.setAttribute('bakedLight',new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*3).fill(.4),3));
    attachSurfaceAppearance(g,123,[3,.3,-.5,.45],[2,.25,0,0]);
    const overrides: MaterialOverrides[]=[{}, {style:'legacy'}, {style:'untextured'}, {colorMask:[0,1,1]},
      {roughnessScale:.6,colorScale:.9}, {fog:{color:0x334455,near:2,far:30}},
      {gradient:{from:'wallWhite',to:'wallGreen',axis:[0,0,1],range:[0,12]}}];
    const errors:string[]=[];const previous=renderer.debug.onShaderError;
    renderer.debug.onShaderError=(gl,program)=>{errors.push(gl.getProgramInfoLog(program)??'shader error');};
    let cases=0;
    try {
      for(const id of Object.keys(SURFACES) as (keyof typeof SURFACES)[]){
        for(const o of overrides){const mesh=new THREE.Mesh(g,materials.variant(id,o));scene.add(mesh);renderer.compile(scene,camera);scene.remove(mesh);cases++;}
      }
      output.textContent=JSON.stringify({revision:SURFACE_VARIATION_KEY,cases,shaderErrors:errors},null,2);
    } catch(e){output.textContent=String(e);} finally {g.dispose();renderer.debug.onShaderError=previous;render();}
  };
}

// JSON is explicit user input; validate the whole snapshot before changing the scene.
const stateArea=document.createElement('textarea');stateArea.id='review-state';stateArea.rows=3;stateArea.cols=90;stateArea.placeholder='保存した条件JSONを貼り付け（カメラ位置・quaternionも復元）';document.body.append(stateArea);
const exportState=document.createElement('button');exportState.textContent='条件JSONを表示';exportState.id='export-state';document.body.append(exportState);
exportState.onclick=()=>{stateArea.value=JSON.stringify(configuration(),null,2);};
const restore=document.createElement('button');restore.textContent='条件JSONを復元';restore.id='restore-state';document.body.append(restore);
restore.onclick=()=>{
 try {
 const c=JSON.parse(stateArea.value);
 const vector=(v:unknown,n:number)=>Array.isArray(v)&&v.length===n&&v.every(x=>typeof x==='number'&&Number.isFinite(x));
 if(c.revision!==REVIEW_REVISION||!Array.from(roomSelect.options).some(o=>o.value===c.room)||!['high','mid','low'].includes(c.quality)||!vector(c.camera?.position,3)||!vector(c.camera?.quaternion,4)||!Number.isFinite(c.camera.fov)||c.camera.fov<10||c.camera.fov>120||!Number.isInteger(c.seed)||!Number.isInteger(c.variant)||c.variant<0||!Number.isFinite(c.exposure)||c.exposure<=0||!['scene','white','warm','raking'].includes(c.lighting)||c.time!==0||c.imagingPreset!=='off'||!Array.from(view.options).some(o=>o.value===c.view)||!Array.from(diagnostic.options).some(o=>o.value===c.diagnostic)||!vector(c.viewport,2)||c.viewport[0]!==REVIEW_WIDTH||c.viewport[1]!==REVIEW_HEIGHT)throw new Error('条件JSONの版・値が不正です');
 roomSelect.value=c.room;tier.value=c.quality;seedInput.value=String(c.seed);variantInput.value=String(c.variant);exposureInput.value=String(c.exposure);view.value=c.view;diagnostic.value=c.diagnostic;lightPreset.value=c.lighting;
 mirrorCheck.checked=c.mirroredUV===true;customCamera=false;show();applyMirror();camera.position.fromArray(c.camera.position);camera.quaternion.fromArray(c.camera.quaternion).normalize();camera.fov=c.camera.fov;customCamera=true;
 for(const [id,value,apply] of [['surface-environment',c.surfaceEnvironment,(v:boolean)=>materials.setSurfaceEnvironment(v)],['surface-wear',c.surfaceWear,(v:boolean)=>materials.setSurfaceWear(v)],['v03-variation',c.surfaceVariation,(v:boolean)=>materials.setSurfaceVariation(v)]] as const){const t=document.querySelector<HTMLInputElement>('#'+id)!;t.checked=value===true;apply(t.checked);}
 if(built)for(const d of built.doors.values()){d.portal.open=c.doorsOpen===true;d.pivot.rotation.y=d.portal.open?-Math.PI*.475:0;}
 render();document.querySelector('#capture')!.textContent='条件JSONを復元しました';
 }catch(e){document.querySelector('#capture')!.textContent=String(e);}
};
const suite=document.createElement('button');suite.id='capture-suite';suite.textContent='V01比較セットを保存';document.querySelector('header')!.append(suite);
suite.onclick=async()=>{
 document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('header button,header input,header select').forEach(e=>e.disabled=true);const records:unknown[]=[];
 try{mirrorCheck.checked=false;applyMirror();for(const id of ['surface-environment','surface-wear','v03-variation'])document.querySelector<HTMLInputElement>('#'+id)!.checked=true;materials.setSurfaceEnvironment(true);materials.setSurfaceWear(true);materials.setSurfaceVariation(true);customCamera=false;camera.fov=72;lightPreset.value='scene';diagnostic.value='beauty';tier.value='high';seedInput.value='42';variantInput.value='0';exposureInput.value='1.25';
 for(const id of VISUAL_CASES)for(const v of ['entry','center','reverse','detail']){roomSelect.value=id;view.value=v;show();await capture('after');records.push({room:id,view:v,result:document.querySelector('#capture')!.textContent});}
 for(const light of ['white','warm','raking']){lightPreset.value=light;positionCamera();await capture('after');records.push({lighting:light,materials:labIds,result:document.querySelector('#capture')!.textContent});}
 report.textContent=JSON.stringify(records,null,2);
 }finally{document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('header button,header input,header select').forEach(e=>e.disabled=false);}
};
