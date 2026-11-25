struct Instance { offsetHeight: vec4f, colorAngle: vec4f }
@group(0) @binding(0) var<uniform> scene: vec4f;
@group(0) @binding(1) var<storage, read> instances: array<Instance>;
struct VertexOut {
    @builtin(position) position: vec4f,
    @location(0) color: vec3f,
    @location(1) normal: vec3f,
}
@vertex
fn vs_main(@location(0) pos: vec3f, @location(1) normal: vec3f,
           @builtin(instance_index) id: u32) -> VertexOut {
    let inst = instances[id];
    let c = cos(inst.colorAngle.w);
    let s = sin(inst.colorAngle.w);
    let local = vec3f(pos.x*0.76, pos.y*inst.offsetHeight.w, pos.z*0.76);
    let p = vec3f(c*local.x+s*local.z,local.y,-s*local.x+c*local.z)+inst.offsetHeight.xyz;
    let n = vec3f(c*normal.x+s*normal.z,normal.y,-s*normal.x+c*normal.z);
    // Câmera ortográfica; profundidade WebGPU entre 0 e 1.
    let az = scene.x;
    let elevation = 0.67;
    let toward = vec3f(cos(elevation)*sin(az),sin(elevation),cos(elevation)*cos(az));
    let right = vec3f(cos(az),0.0,-sin(az));
    let up = cross(toward,right);
    let extent = scene.z;
    let aspect = scene.y;
    var out: VertexOut;
    out.position = vec4f(dot(p,right)/(extent*max(aspect,1.0)),dot(p,up)/(extent*max(1.0/aspect,1.0)),0.5-dot(p,toward)/(extent*4.0),1.0);
    out.normal=n; out.color=inst.colorAngle.xyz;
    return out;
}
@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4f {
    let light=normalize(vec3f(-0.6,1.0,0.45));
    let diffuse=0.44+0.56*max(dot(normalize(in.normal),light),0.0);
    return vec4f(in.color*diffuse,1.0);
}
