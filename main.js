const $ = id => document.getElementById(id);
const canvas = $('canvas'), fmt = new Intl.NumberFormat('pt-BR');
let count=1000, mode='instanced', dirty=true, ready=false, angle=.8;
let cpu=[], frames=[], last=0, report=0;
function update(){
    $('countText').textContent=fmt.format(count);
    for(const m of ['traditional','instanced']) $(m).setAttribute('aria-pressed',mode===m);
    $('drawCalls').textContent=ready?fmt.format(mode==='instanced'?1:count):'—';
    $('triangles').textContent=ready?fmt.format(count*12):'—';
    $('code').textContent=mode==='instanced'?`// Uma única chamada de desenho.\npass.drawIndexed(indexCount, ${count});`:`// Uma chamada por objeto.\nfor (let i = 0; i < ${count}; i++) {\n  pass.drawIndexed(indexCount, 1, 0, 0, i);\n}`;
    $('description').textContent=mode==='instanced'?'O segundo argumento define quantas cópias desenhar. O vertex shader identifica cada uma por instance_index.':'Cada chamada desenha uma cópia. firstInstance seleciona o mesmo registro usado no modo instanciado.';
}
function reset(){cpu=[];frames=[];last=0;$('cpu').textContent='—';$('fps').textContent='—';}
function setCount(v){count=Number(v);$('count').value=count;dirty=true;reset();update();}
$('count').oninput=e=>setCount(e.target.value);
for(const b of document.querySelectorAll('[data-count]'))b.onclick=()=>setCount(b.dataset.count);
for(const m of ['traditional','instanced'])$(m).onclick=()=>{mode=m;reset();update();};
update();
// Malha única, 24 vértices (normais por face), 36 índices.
function cubeMesh(){
    const faces=[[[0,0,1],[[-.5,0,.5],[.5,0,.5],[.5,1,.5],[-.5,1,.5]]],[[0,0,-1],[[.5,0,-.5],[-.5,0,-.5],[-.5,1,-.5],[.5,1,-.5]]],[[1,0,0],[[.5,0,.5],[.5,0,-.5],[.5,1,-.5],[.5,1,.5]]],[[-1,0,0],[[-.5,0,-.5],[-.5,0,.5],[-.5,1,.5],[-.5,1,-.5]]],[[0,1,0],[[-.5,1,.5],[.5,1,.5],[.5,1,-.5],[-.5,1,-.5]]],[[0,-1,0],[[-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5]]]];
    const v=[],i=[];
    for(const [n,points] of faces){const b=v.length/6;for(const p of points)v.push(...p,...n);i.push(b,b+1,b+2,b,b+2,b+3);}
    return {vertices:new Float32Array(v),indices:new Uint16Array(i)};
}
function error(message){ready=false;$('status').textContent='WebGPU indisponível';$('error').hidden=false;$('error').textContent=message;reset();update();}
async function start(){
    if(!navigator.gpu)throw Error('WebGPU indisponível. Use Chrome ou Edge atualizado via localhost, com aceleração gráfica habilitada.');
    const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('Nenhum adaptador WebGPU encontrado. Verifique o driver e a aceleração gráfica.');
    const device=await adapter.requestDevice();let stopped=false;
    device.lost.then(info=>{stopped=true;error('Dispositivo perdido: '+info.message);});
    device.addEventListener('uncapturederror',e=>{stopped=true;console.error(e.error);error(e.error.message);});
    const context=canvas.getContext('webgpu'), format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'opaque'});
    const mesh=cubeMesh(), indexCount=mesh.indices.length;
    function upload(data,usage){const b=device.createBuffer({size:data.byteLength,usage:usage|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(b,0,data);return b;}
    const vertex=upload(mesh.vertices,GPUBufferUsage.VERTEX), index=upload(mesh.indices,GPUBufferUsage.INDEX);
    const instances=device.createBuffer({size:10000*32,usage:GPUBufferUsage.STORAGE});
    const uniform=()=>device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    const scene=uniform(), config=uniform();
    async function shader(path){const r=await fetch(path);if(!r.ok)throw Error('Falha ao carregar '+path);const m=device.createShaderModule({code:await r.text()});const info=await m.getCompilationInfo();const errors=info.messages.filter(x=>x.type==='error');if(errors.length)throw Error(errors.map(x=>`${path}:${x.lineNum}: ${x.message}`).join('\n'));return m;}
    const [render,generate]=await Promise.all([shader('shader.wgsl'),shader('generate.wgsl')]);
    const pipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:render,entryPoint:'vs_main',buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'}]}]},fragment:{module:render,entryPoint:'fs_main',targets:[{format}]},primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});
    const compute=await device.createComputePipelineAsync({layout:'auto',compute:{module:generate,entryPoint:'generate'}});
    const group=(p,b)=>device.createBindGroup({layout:p.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:b}},{binding:1,resource:{buffer:instances}}]});
    const renderGroup=group(pipeline,scene), computeGroup=group(compute,config);
    let depth;
    function resize(){const d=Math.min(devicePixelRatio,2), w=Math.max(1,Math.round(canvas.clientWidth*d)),h=Math.max(1,Math.round(canvas.clientHeight*d));if(!depth||canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;depth?.destroy();depth=device.createTexture({size:[w,h],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});}}
    ready=true;$('status').textContent='WebGPU ativo';update();
    const push=(a,v)=>{a.push(v);if(a.length>60)a.shift();};const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
    function frame(now){
        if(stopped)return;resize();const dt=last?now-last:0;if(dt>0&&dt<1000)push(frames,dt);last=now;
        if($('rotate').checked)angle+=Math.min(dt,50)*.00018;
        const side=Math.ceil(Math.sqrt(count));device.queue.writeBuffer(scene,0,new Float32Array([angle,canvas.width/canvas.height,side*.65+1.3,count]));
        // Compute pass: apenas quando a quantidade de instâncias muda.
        if(dirty){device.queue.writeBuffer(config,0,new Uint32Array([count,side,0,0]));const enc=device.createCommandEncoder();const pass=enc.beginComputePass();pass.setPipeline(compute);pass.setBindGroup(0,computeGroup);pass.dispatchWorkgroups(Math.ceil(count/64));pass.end();device.queue.submit([enc.finish()]);dirty=false;}
        const view=context.getCurrentTexture().createView(), t0=performance.now();
        const enc=device.createCommandEncoder();const pass=enc.beginRenderPass({colorAttachments:[{view,clearValue:{r:.90,g:.92,b:.87,a:1},loadOp:'clear',storeOp:'store'}],depthStencilAttachment:{view:depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});
        pass.setPipeline(pipeline);pass.setBindGroup(0,renderGroup);pass.setVertexBuffer(0,vertex);pass.setIndexBuffer(index,'uint16');
        // Única diferença entre os modos: a quantidade de draw calls.
        if(mode==='instanced')pass.drawIndexed(indexCount,count);
        else for(let i=0;i<count;i++)pass.drawIndexed(indexCount,1,0,0,i);
        pass.end();const commands=enc.finish();push(cpu,performance.now()-t0);device.queue.submit([commands]);
        if(now-report>350){$('cpu').textContent=avg(cpu).toFixed(2)+' ms';$('fps').textContent=frames.length?(1000/avg(frames)).toFixed(0):'—';report=now;}
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
start().catch(e=>{console.error(e);error(e.message);});
