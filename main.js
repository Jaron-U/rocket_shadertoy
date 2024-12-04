const canvas = document.getElementById('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gl = canvas.getContext('webgl');
if (!gl) {
    alert('WebGL not supported in this browser.');
}

// Vertex shader program
const vsSource = `
    attribute vec4 aVertexPosition;
    void main(void) {
        gl_Position = aVertexPosition;
    }
`;

// Fragment shader program (your GLSL code)
const fsSource = `
    precision mediump float;

    uniform vec2 iResolution;
    uniform float iTime;
    uniform vec2 iMouse;
    uniform sampler2D iChannel0;
    uniform sampler2D iChannel1;
    uniform sampler2D iChannel2;
    uniform sampler2D iChannel3;

    ${glslCode()}
`;

// Initialize a shader program
const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

// Collect all the info needed to use the shader program
const programInfo = {
    program: shaderProgram,
    attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
        iResolution: gl.getUniformLocation(shaderProgram, 'iResolution'),
        iTime: gl.getUniformLocation(shaderProgram, 'iTime'),
        iMouse: gl.getUniformLocation(shaderProgram, 'iMouse'),
        iChannel0: gl.getUniformLocation(shaderProgram, 'iChannel0'),
        iChannel1: gl.getUniformLocation(shaderProgram, 'iChannel1'),
        iChannel2: gl.getUniformLocation(shaderProgram, 'iChannel2'),
        iChannel3: gl.getUniformLocation(shaderProgram, 'iChannel3'),
    },
};

// Initialize buffers
const buffers = initBuffers(gl);

// Load textures (modified to handle video texture for iChannel3)
loadTextures(gl).then(({ textures, video }) => {
    // Track mouse position
    let mouseX = 0;
    let mouseY = 0;
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = canvas.height - (e.clientY - rect.top);
    });

    // Draw the scene repeatedly
    let then = 0;
    function render(now) {
        now *= 0.001; // Convert to seconds
        const deltaTime = now - then;
        then = now;

        updateVideoTexture(gl, textures[3], video);

        drawScene(gl, programInfo, buffers, textures, now, mouseX, mouseY);

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
});

// Function definitions (updated loadTextures and new functions for video texture)
function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    // Create the shader program
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    // Check if the program was created successfully
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert(
            'Unable to initialize the shader program: ' +
                gl.getProgramInfoLog(shaderProgram)
        );
        return null;
    }
    return shaderProgram;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);

    // Send the source to the shader object
    gl.shaderSource(shader, source);

    // Compile the shader program
    gl.compileShader(shader);

    // Check if compiled successfully
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(
            'An error occurred compiling the shaders: ' +
                gl.getShaderInfoLog(shader)
        );
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function initBuffers(gl) {
    // Create a buffer for the square's positions
    const positionBuffer = gl.createBuffer();

    // Select the positionBuffer as the one to apply buffer operations to
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Create an array of positions for the square (two triangles)
    const positions = [
        -1.0,  1.0,
        -1.0, -1.0,
         1.0,  1.0,
         1.0, -1.0,
    ];

    // Pass the positions to WebGL
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.STATIC_DRAW
    );

    return {
        position: positionBuffer,
    };
}

function loadTextures(gl) {
    const textures = [];
    const promises = [];

    // Load images for iChannel0 to iChannel2
    for (let i = 0; i < 3; i++) {
        const texture = gl.createTexture();
        const image = new Image();

        const promise = new Promise((resolve) => {
            image.onload = () => {
                gl.bindTexture(gl.TEXTURE_2D, texture);

                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.RGBA,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    image
                );

                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                // gl.generateMipmap(gl.TEXTURE_2D);
                resolve();
            };
        });

        // Provide your own images for iChannel0 to iChannel2
        image.src = `./final_assets/texture${i}.png`;
        textures.push(texture);
        promises.push(promise);
    }

    // Load video texture for iChannel3
    const videoTexture = gl.createTexture();
    const video = setupVideo('./final_assets/video.mp4');

    // Set up the texture parameters
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    textures.push(videoTexture);

    return Promise.all(promises).then(() => {
        return { textures, video };
    });
}

function setupVideo(url) {
    const video = document.createElement('video');
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.src = url;
    video.crossOrigin = 'anonymous';

    video.play();

    return video;
}

function updateVideoTexture(gl, texture, video) {
    if (video.readyState >= video.HAVE_CURRENT_DATA) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            video
        );
        // No need to generate mipmaps for video textures
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
}

function drawScene(gl, programInfo, buffers, textures, time, mouseX, mouseY) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.BLEND);

    // Tell WebGL to use our shader program
    gl.useProgram(programInfo.program);

    // Set the positions
    {
        const numComponents = 2; // Pull out 2 values per iteration
        const type = gl.FLOAT; // Data in the buffer is 32-bit floats
        const normalize = false;
        const stride = 0; // How many bytes to get from one set of values to the next
        const offset = 0; // How many bytes inside the buffer to start from

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexPosition,
            numComponents,
            type,
            normalize,
            stride,
            offset
        );
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
    }

    // Set the shader uniforms
    gl.uniform2f(
        programInfo.uniformLocations.iResolution,
        canvas.width,
        canvas.height
    );
    gl.uniform1f(programInfo.uniformLocations.iTime, time);
    gl.uniform2f(programInfo.uniformLocations.iMouse, mouseX, mouseY);

    // Bind textures
    for (let i = 0; i < textures.length; i++) {
        gl.activeTexture(gl[`TEXTURE${i}`]);
        gl.bindTexture(gl.TEXTURE_2D, textures[i]);
        gl.uniform1i(programInfo.uniformLocations[`iChannel${i}`], i);
    }

    // Draw the scene
    {
        const offset = 0;
        const vertexCount = 4;
        gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
    }
}

function glslCode() {
    return `
const float pi=3.1416;

const int KEY_LEFT  = 37;
const int KEY_UP    = 38;
const int KEY_RIGHT = 39;
const int KEY_DOWN  = 40;

float random (vec2 st) {
    return fract(sin(dot(st.xy,vec2(12.9898,78.233)))*43758.5453123);
}

float smooth_step( float min, float max, float x )
{
    float t =(x - min) / (max - min);
    t = clamp(t, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t); // smoothstep formula   
    return t;
}

float step2( float min, float max, float x )
{
    float t =(x - min) / (max - min);
    t = clamp(t, 0.0, 1.0); 
    return t;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // vec2 uv = fragCoord/iResolution.xy; // Normalized pixel coordinates
    vec2 uv = fragCoord.xy / iResolution.xy;
    uv.y = 1.0 - uv.y;

    vec4 col = vec4(0.0);
    vec4 border_color= vec4(0.0,0.0,0.0, 1.0);
    vec4 spec= vec4(1.0,1.0,0.0, 1.0);
    vec4 ambi= vec4(0.10,0.20,0.70, 1.0);
    vec4 diff= vec4(0.90,0.70,0.20, 1.0);
    vec4 img0 = texture2D(iChannel0, uv);
    vec4 img1=  texture2D(iChannel1, uv);
    vec4 Ks=texture2D(iChannel2, uv);

    vec3 eye=vec3(0.0,0.0,10.0); 
    eye = eye-vec3(fragCoord,0.0);
    eye = eye/length(eye); 

    vec3 normals; 
    vec3 reflect;
    float d=100.0;
    vec3 lightpos = vec3(iMouse.x,iMouse.y,d/2.0);
    vec3 dir = lightpos-vec3(fragCoord,0.0);
    dir=dir/length(dir); 

    normals= 2.0*img0.rgb - vec3(1.0); 
    normals = normals/length(normals); 
    reflect = 2.0*dot(dir,normals)*normals-dir;
    float t= 0.5*dot(dir,normals)+0.5;
    float s= 0.5*dot(reflect,eye)+0.5;
    float b=1.0;

    vec2 reflected_uv= (reflect.xy*d/(reflect.z+0.1)+fragCoord+lightpos.xy)/iResolution.xy;
    vec4 reflected_env= texture2D(iChannel1, reflected_uv);

    t=step2(0.1,0.99,t);
    s=step2(0.99,1.0,s);
    vec4 border=texture2D(iChannel3,uv);

    col = ambi*(1.0-t)+diff*t; 
    col= col*(1.0-Ks)+Ks*max(0.3*reflected_env,s*spec); 
    col = (1.0-border)*border_color+ border*col;

    fragColor = vec4(col.rgb, 1.0);    // Output to screen
}

void main(void) {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
    `;

}


