import { LayeredCanvas, Layer, sequentializeMouse } from "./layeredCanvas.js";
import { FrameElement, calculatePhysicalLayout, findLayoutAt } from "./frameTree.js";
import { translate, scale } from "./pictureControl.js";
import { initialieKeyCache, keyDownFlags } from "./keyCache.js";

let layeredCanvas;
let frameLayer;

class FrameLayer extends Layer {
    constructor(frameTree) {
        super();
        this.frameTree = frameTree;
    }

    render(canvas, ctx) {
        const size = [canvas.width, canvas.height];
        const layout = calculatePhysicalLayout(this.frameTree, [840, 1188], [0, 0]);
        console.log("render", layout);
        this.renderElement(ctx, layout);
    }

    renderElement(ctx, layout) {
        if (layout.children){
            for (let i = 0; i < layout.children.length; i++) {
                this.renderElement(ctx, layout.children[i]);
            }
        } else {
            this.renderElementLeaf(ctx, layout);
        }
    }

    renderElementLeaf(ctx, layout) {
        const origin = layout.origin;
        const size = layout.size;

        ctx.fillStyle = "rgb(255,255,255)";
        ctx.fillRect(origin[0], origin[1], size[0], size[1]);

        const element = layout.element;
        if (element.image) {
            // clip
            ctx.save();
            ctx.beginPath();
            ctx.rect(origin[0], origin[1], size[0], size[1]);
            ctx.clip();
            // draw to center
            const scale = element.scale[0]; // 今のところxとyは同じ
            const x = origin[0] + (size[0] - element.image.width * scale) / 2 + element.translation[0];
            const y = origin[1] + (size[1] - element.image.height * scale) / 2 + element.translation[1];
            ctx.drawImage(element.image, x, y, element.image.width * scale, element.image.height * scale);

            // unclip
            ctx.restore();
        }

        ctx.strokeStyle = "rgb(0,0,0)";
        ctx.lineWidth = 1;
        ctx.strokeRect(origin[0], origin[1], size[0], size[1]);
    }

    dropped(image, position) {
        const size = [image.width, image.height];
        const layout = calculatePhysicalLayout(this.frameTree, [840, 1188], [0, 0]);
        let layoutlet = findLayoutAt(layout, position);
        if (layoutlet) {
            // calc expansion to longer size
            const scale = Math.max(layoutlet.size[0] / size[0], layoutlet.size[1] / size[1]);
            layoutlet.element.scale = [scale, scale];
            console.log(scale);
            layoutlet.element.image = image;
            this.redraw();
            return true;
        }
        return false;
    }

    accepts(point) {
        const size = [840, 1188];
        const layout = calculatePhysicalLayout(this.frameTree, size, [0, 0]);
        const layoutElement = findLayoutAt(layout, point);
        if (layoutElement && layoutElement.element.image) {
            console.log("accepts");
            return layoutElement.element;
        }
        return null;
    }

    *mouse(p, element) {
        if (keyDownFlags["AltLeft"] || keyDownFlags["AltRight"]) {
            const origin = element.translation;
            yield* translate(p, (q) => {
                element.translation = [origin[0] + q[0], origin[1] + q[1]];
                this.redraw(); // TODO: できれば、移動した要素だけ再描画したい
            });
        } else if (keyDownFlags["ControlLeft"] || keyDownFlags["ControlRight"]) {
            const origin = element.scale;
            yield* scale(p, (q) => {
                const s = Math.max(q[0], q[1]);
                element.scale = [origin[0] * s, origin[1] * s];
                this.redraw(); // TODO: できれば、移動した要素だけ再描画したい
            });
        }
    }
}

function loadImage(relativePath) {
    var img = new Image();
    img.src = relativePath;
    return img;
}

function markUpChanged(markUp) {
    console.log(markUp);
    let json;
    try {
        // parse json
        json = JSON.parse(markUp);
    }
    catch (e) {
        // ignore
        const errorArea = document.getElementById("markUpError");
        errorArea.value = e;
    }

    try {
        const frameTree = FrameElement.compile(json);
        layeredCanvas.layers[0].frameTree = frameTree;
        layeredCanvas.redraw();
    }
    catch(e) {

    }
}


export function doIt() {
    const markUp = {
        "margin" : {
            "top": 4,
            "bottom": 4,
            "left": 8,
            "right": 8,
        },
        "width": 180,
        "spacing": 2,
        "column": [
            { "height": 17 },
            { "height": 25, 
              "spacing": 2,
              "row": [
                { "width": 45 },
                { "width": 55 },
              ],
            },
            { "height": 17 }
        ]
    };

    console.log("doIt");

    let canvas = document.getElementById("canvas");
    initialieKeyCache(canvas,
        (code) => {
            return code === "AltLeft" || code === "AltRight" || code === "ControlLeft" || code === "ControlRight";
        });

    const frameTree = FrameElement.compile(markUp);

    // load image from file
    /*
    frameTree.children[0].image  = loadImage("./samples/frame1.png");
    frameTree.children[1].children[0].image  = loadImage("./samples/frame2.png");
    frameTree.children[1].children[1].image  = loadImage("./samples/frame3.png");
    */

    sequentializeMouse(FrameLayer);
    layeredCanvas = new LayeredCanvas(canvas);
    frameLayer = new FrameLayer(frameTree);
    layeredCanvas.addLayer(frameLayer);
    layeredCanvas.redraw();

    const markUpTextArea = document.getElementById("markUp");
    console.log(markUpTextArea);
    // markUpTextArea.value = JSON.stringify(markUp);
    markUpTextArea.addEventListener("input", (e) => {
        markUpChanged(markUpTextArea.value);
    });
}

