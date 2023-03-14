import { fitCurve } from "./fitCurve.js";

export function doVect() {
    // load ./testdot.png
    const img = new Image();
    img.src = './testdot.png';
    img.onload = () => {
        // get imagedata
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        // get pixel data
        const data = imgData.data;
        // get pixel count
        const pixelCount = img.width * img.height;
        // create array of byte8
        const byte8 = new Uint8Array(pixelCount);
        // convert pixel data to byte8
        for (let i = 0; i < pixelCount; i++) {
            byte8[i] = data[i*4] < 128 ? 1 : 0;
        }
        console.log(byte8);

        const edgeField = makeEdgeField(byte8, [img.width, img.height]);
        console.log(edgeField);
        const paths = scanEdgeField(edgeField, [img.width, img.height]);
        console.log(paths);

        // draw paths(x128)
        const drawCanvas = document.getElementById('canvas');
        const drawCtx = drawCanvas.getContext('2d');
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        drawCtx.drawImage(img, 0, 0, 512, 512);
        drawCtx.beginPath();
        drawCtx.strokeStyle = 'red';
        drawCtx.lineWidth = 1;

        for (let i = 0; i < paths.length; i++) {
            const path = paths[i].points.map(p => [p.x*64, p.y*64]);
            path.push(path[0]);
            console.log(path);
            const curves = fitCurve(path, 50);
            for (let j = 0 ; j < curves.length; j++) {
                const curve = curves[j];
                console.log(curve); // [[0, 0], [20.27317402, 20.27317402], [-1.24665147, 0], [20, 0]]
                drawCtx.moveTo(curve[0][0], curve[0][1]);
                drawCtx.bezierCurveTo(
                    curve[1][0], curve[1][1],
                    curve[2][0], curve[2][1],
                    curve[3][0], curve[3][1]
                );
            }
        }
        drawCtx.stroke();
    };
}

// edge detection
// Edge node types ( ▓: this layer or 1; ░: not this layer or 0 )
// 12  ░░  ▓░  ░▓  ▓▓  ░░  ▓░  ░▓  ▓▓  ░░  ▓░  ░▓  ▓▓  ░░  ▓░  ░▓  ▓▓
// 48  ░░  ░░  ░░  ░░  ░▓  ░▓  ░▓  ░▓  ▓░  ▓░  ▓░  ▓░  ▓▓  ▓▓  ▓▓  ▓▓
//     0   1   2   3   4   5   6   7   8   9   10  11  12  13  14  15
function makeEdgeField(src, [aw,ah]){
    // Looping through all pixels and calculating edge node type
    function fetch(x,y) { return src[y*aw+x]; }
    function put(x,y,n) { dst[y*aw+x] = n; }

    const dst = new Uint8Array(aw*ah);
    
    for(let j=1; j<ah; j++){
        for(let i=1; i<aw; i++){
            put(i,j,
                (fetch(j-1,i-1) * 1) +
                (fetch(j-1,i) * 2) +
                (fetch(j,i-1) * 8) +
                (fetch(j,i) * 4));
        }
    }
        
    return dst;
}

// 3. Walking through an edge node array, discarding edge node types 0 and 15 and creating paths from the rest.
// Walk directions (dir): 0 > ; 1 ^ ; 2 < ; 3 v 
function scanEdgeField(src, [aw,ah]) {
    function fetch(x,y) { return src[y*aw+x]; }
    function put(x,y,n) { src[y*aw+x] = n; }

    // Lookup tables for pathscan
    // pathscan_combined_lookup[ arr[py][px] ][ dir ] = [nextarrpypx, nextdir, deltapx, deltapy];
    const pathscan_combined_lookup = [
        [[-1,-1,-1,-1], [-1,-1,-1,-1], [-1,-1,-1,-1], [-1,-1,-1,-1]],// arr[py][px]===0 is invalid
        [[ 0, 1, 0,-1], [-1,-1,-1,-1], [-1,-1,-1,-1], [ 0, 2,-1, 0]],
        [[-1,-1,-1,-1], [-1,-1,-1,-1], [ 0, 1, 0,-1], [ 0, 0, 1, 0]],
        [[ 0, 0, 1, 0], [-1,-1,-1,-1], [ 0, 2,-1, 0], [-1,-1,-1,-1]],
        
        [[-1,-1,-1,-1], [ 0, 0, 1, 0], [ 0, 3, 0, 1], [-1,-1,-1,-1]],
        [[13, 3, 0, 1], [13, 2,-1, 0], [ 7, 1, 0,-1], [ 7, 0, 1, 0]],
        [[-1,-1,-1,-1], [ 0, 1, 0,-1], [-1,-1,-1,-1], [ 0, 3, 0, 1]],
        [[ 0, 3, 0, 1], [ 0, 2,-1, 0], [-1,-1,-1,-1], [-1,-1,-1,-1]],
        
        [[ 0, 3, 0, 1], [ 0, 2,-1, 0], [-1,-1,-1,-1], [-1,-1,-1,-1]],
        [[-1,-1,-1,-1], [ 0, 1, 0,-1], [-1,-1,-1,-1], [ 0, 3, 0, 1]],
        [[11, 1, 0,-1], [14, 0, 1, 0], [14, 3, 0, 1], [11, 2,-1, 0]],
        [[-1,-1,-1,-1], [ 0, 0, 1, 0], [ 0, 3, 0, 1], [-1,-1,-1,-1]],
        
        [[ 0, 0, 1, 0], [-1,-1,-1,-1], [ 0, 2,-1, 0], [-1,-1,-1,-1]],
        [[-1,-1,-1,-1], [-1,-1,-1,-1], [ 0, 1, 0,-1], [ 0, 0, 1, 0]],
        [[ 0, 1, 0,-1], [-1,-1,-1,-1], [-1,-1,-1,-1], [ 0, 2,-1, 0]],
        [[-1,-1,-1,-1], [-1,-1,-1,-1], [-1,-1,-1,-1], [-1,-1,-1,-1]]// arr[py][px]===15 is invalid
    ];

    function updateBoundingBox(bb, x, y){
        if(x < bb[0]) { bb[0] = x; }
        if(x > bb[2]) { bb[2] = x; }
        if(y < bb[1]) { bb[1] = y; }
        if(y > bb[3]) { bb[3] = y; }
    }

    var paths=[];

    for(var j=0; j<ah; j++){
        for(var i=0; i<aw; i++){
            if(fetch(i,j) !== 4) { continue; }
            // Init
            let px = i, py = j;
            let path = { points: [], boundingbox: [px,py,px,py], holechildren: [] };
            paths.push(path)
            let dir = 1;

            // Path points loop
            while(true) {
                // New path point
                const point = { x: px, y: py, t: fetch(px,py) };
                path.points.push(point);
                
                updateBoundingBox(path.boundingbox, px, py);
                
                // Next: look up the replacement, direction and coordinate changes = clear this cell, turn if required, walk forward
                console.log(px, py, fetch(px,py), dir);
                const lookuprow = pathscan_combined_lookup[fetch(px,py)][dir];
                put(px,py, lookuprow[0]); dir = lookuprow[1]; px += lookuprow[2]; py += lookuprow[3];

                if(px === path.points[0].x && py === path.points[0].y){
                    break;
                }
            }
        }
    }
    
    return paths;
}

