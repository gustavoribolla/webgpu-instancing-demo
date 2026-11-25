// Gera os atributos de cada objeto diretamente na GPU.
struct Instance { offsetHeight: vec4f, colorAngle: vec4f }
struct Config { count: u32, side: u32, pad0: u32, pad1: u32 }
@group(0) @binding(0) var<uniform> config: Config;
@group(0) @binding(1) var<storage, read_write> instances: array<Instance>;
fn hash(x: u32) -> f32 {
    var n = x;
    n = (n ^ (n >> 16u)) * 0x7feb352du;
    n = (n ^ (n >> 15u)) * 0x846ca68bu;
    n = n ^ (n >> 16u);
    return f32(n & 0x00ffffffu) / 16777216.0;
}
@compute @workgroup_size(64)
fn generate(@builtin(global_invocation_id) invocation: vec3u) {
    let i = invocation.x;
    if (i >= config.count) { return; }
    let center = (f32(config.side)-1.0)*0.5;
    let x = f32(i % config.side)-center;
    let z = f32(i / config.side)-center;
    let h = 0.4 + 2.8*hash(i+31u);
    let color = mix(vec3f(0.19,0.42,0.33),vec3f(0.77,0.85,0.56),hash(i+123u));
    instances[i].offsetHeight = vec4f(x*1.13,0.0,z*1.13,h);
    instances[i].colorAngle = vec4f(color,(hash(i+791u)-0.5)*0.38);
}
